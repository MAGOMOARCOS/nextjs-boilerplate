import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/supabaseServer';

type Body = {
  name?: string;
  email?: string;
  city?: string;
  role?: string;
  wa?: string;        // WhatsApp del formulario
  phone?: string;     // por si algún día lo envías como phone
  message?: string;
  honeypot?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function cleanStr(v: unknown) {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}

function normalizePhone(v: string | null) {
  if (!v) return null;
  // deja + y dígitos, quita espacios/guiones/etc
  const p = v.replace(/[^\d+]/g, '');
  return p.length ? p.slice(0, 32) : null;
}

export async function POST(request: Request) {
  try {
    const body: Body = await request.json().catch(() => ({} as Body));

    // Honeypot anti-bots: si viene relleno, respondemos OK sin hacer nada
    const honeypot = cleanStr(body.honeypot);
    if (honeypot) {
      return NextResponse.json({ ok: true, message: '✅ Apuntado.' }, { status: 200 });
    }

    const email = cleanStr(body.email);
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: 'Email inválido' }, { status: 400 });
    }

    const name = cleanStr(body.name);
    const city = cleanStr(body.city);
    const role = cleanStr(body.role);
    const message = cleanStr(body.message);

    // El formulario manda "wa" pero la columna real en tu tabla es "phone"
    const phone = normalizePhone(cleanStr(body.wa) ?? cleanStr(body.phone));

    const source =
      request.headers.get('referer') ||
      request.headers.get('origin') ||
      'landing';

    // 1) ¿Existe ya?
    const existing = await supabaseServer
      .from('leads')
      .select('id, email, name, city, role, phone')
      .eq('email', email)
      .maybeSingle();

    if (existing.error) {
      console.error('[API /leads] select error', existing.error);
      return NextResponse.json({ ok: false, error: 'Database error' }, { status: 500 });
    }

    // 2) Si existe: UPDATE de campos informados (y distintos)
    if (existing.data) {
      const updates: Record<string, string> = {};

      if (name && name !== existing.data.name) updates.name = name;
      if (city && city !== existing.data.city) updates.city = city;
      if (role && role !== existing.data.role) updates.role = role;
      if (phone && phone !== existing.data.phone) updates.phone = phone;
      if (message && message !== (existing.data as any).message) updates.message = message;

      if (Object.keys(updates).length === 0) {
        return NextResponse.json(
          { ok: true, status: 'already', message: '✅ Ya estabas apuntado (ese email ya estaba registrado).' },
          { status: 200 }
        );
      }

      const upd = await supabaseServer
        .from('leads')
        .update({ ...updates, source })
        .eq('email', email);

      if (upd.error) {
        console.error('[API /leads] update error', upd.error);
        return NextResponse.json({ ok: false, error: 'Database error' }, { status: 500 });
      }

      return NextResponse.json(
        { ok: true, status: 'updated', message: '✅ Ya estabas apuntado y hemos actualizado tus datos.' },
        { status: 200 }
      );
    }

    // 3) Si no existe: INSERT
    const payload: Record<string, any> = { email, source };
    if (name) payload.name = name;
    if (city) payload.city = city;
    if (role) payload.role = role;
    if (phone) payload.phone = phone;
    if (message) payload.message = message;

    const ins = await supabaseServer.from('leads').insert(payload);

    if (ins.error) {
      // si hay carrera y se insertó a la vez, tratamos como “ya existe”
      if (ins.error.code === '23505') {
        return NextResponse.json(
          { ok: true, status: 'already', message: '✅ Ya estabas apuntado (ese email ya estaba registrado).' },
          { status: 200 }
        );
      }
      console.error('[API /leads] insert error', ins.error);
      return NextResponse.json({ ok: false, error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json(
      { ok: true, status: 'inserted', message: '✅ Apuntado. Gracias, te contactamos pronto.' },
      { status: 200 }
    );
  } catch (err) {
    console.error('[API /leads] unexpected error', err);
    return NextResponse.json({ ok: false, error: 'Database error' }, { status: 500 });
  }
}
