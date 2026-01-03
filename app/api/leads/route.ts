import { NextResponse } from 'next/server';
import { supabaseServer } from '../../lib/supabaseServer';

type Body = {
  name?: string;
  email?: string;
  city?: string;
  role?: string;

  // compatibilidad por si el frontend manda otro nombre
  phone?: string;
  wa?: string;
  whatsapp?: string;

  source?: string;
  honeypot?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Normaliza teléfono/WhatsApp: deja + y dígitos (sin espacios)
function normalizePhone(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[^\d+]/g, '');
  return cleaned || null;
}

export async function POST(request: Request) {
  try {
    const body: Body = await request.json().catch(() => ({} as Body));

    // Honeypot anti-bots
    if ((body.honeypot || '').trim()) {
      return NextResponse.json({ ok: true, message: 'OK' }, { status: 200 });
    }

    const email = (body.email || '').trim().toLowerCase();
    const name = (body.name || '').trim() || null;
    const city = (body.city || '').trim() || null;
    const role = (body.role || '').trim() || null;

    const phoneRaw = (body.phone || body.wa || body.whatsapp || '').toString();
    const phone = normalizePhone(phoneRaw);

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 400 });
    }

    const source = (body.source || 'landing').trim() || 'landing';

    // 1) ¿Existe ya ese email?
    const existing = await supabaseServer
      .from('leads')
      .select('id,email,name,city,role,phone')
      .eq('email', email)
      .maybeSingle();

    if (existing.error) {
      console.error('leads select error', existing.error);
      return NextResponse.json({ ok: false, error: 'Database error' }, { status: 500 });
    }

    // 2) Si no existe: INSERT
    if (!existing.data) {
      const ins = await supabaseServer
        .from('leads')
        .insert({
          email,
          name,
          city,
          role,
          phone,
          source,
        })
        .select('id')
        .single();

      if (ins.error) {
        console.error('leads insert error', ins.error);
        return NextResponse.json({ ok: false, error: 'Database error' }, { status: 500 });
      }

      return NextResponse.json(
        { ok: true, message: '✅ Apuntado. Gracias, te contactamos pronto.' },
        { status: 200 }
      );
    }

    // 3) Si existe: UPDATE sólo de campos que vengan y cambien
    const cur = existing.data;
    const patch: Record<string, any> = {};

    if (name && name !== cur.name) patch.name = name;
    if (city && city !== cur.city) patch.city = city;
    if (role && role !== cur.role) patch.role = role;
    if (phone && phone !== cur.phone) patch.phone = phone;

    // si quieres refrescar "source" siempre, descomenta:
    // if (source && source !== cur.source) patch.source = source;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { ok: true, message: '✅ Ya estabas apuntado (sin cambios).' },
        { status: 200 }
      );
    }

    const upd = await supabaseServer
      .from('leads')
      .update(patch)
      .eq('id', cur.id)
      .select('id')
      .single();

    if (upd.error) {
      console.error('leads update error', upd.error);
      return NextResponse.json({ ok: false, error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json(
      { ok: true, message: '✅ Datos actualizados (ese email ya estaba registrado).' },
      { status: 200 }
    );
  } catch (e) {
    console.error('API /leads fatal', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
