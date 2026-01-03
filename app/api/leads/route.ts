import { NextResponse } from 'next/server';
import { supabaseServer } from '../../lib/supabaseServer';

type Body = {
  name?: string;
  email?: string;
  city?: string;
  role?: string;

  // el front envía "wa" (tu input name="wa")
  wa?: string;

  // por compatibilidad si en algún momento cambias el front
  whatsapp?: string;
  phone?: string;

  message?: string;
  source?: string;
  honeypot?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Colombia: el número nacional son 10 dígitos.
 * Aceptamos:
 * - "3001234567" (10)
 * - "+57 3001234567" (se normaliza a 3001234567)
 * - "0573001234567" NO (lo normal sería 0 + 10 -> 11). Si llega "0" + 10, lo recortamos.
 * Rechazamos cualquier otra longitud.
 */
function normalizeCOPhone(raw: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = (raw || '').trim();
  if (!trimmed) return { ok: true, value: null };

  let digits = trimmed.replace(/\D/g, '');

  // +57XXXXXXXXXX => 12 dígitos empezando por 57
  if (digits.length === 12 && digits.startsWith('57')) digits = digits.slice(2);

  // 0XXXXXXXXXX => 11 dígitos empezando por 0 (por si alguien lo pone)
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);

  if (digits.length !== 10) {
    return {
      ok: false,
      error: 'WhatsApp inválido: en Colombia debe tener EXACTAMENTE 10 dígitos. Ej: 3001234567',
    };
  }

  return { ok: true, value: digits };
}

export async function POST(request: Request) {
  try {
    const body: Body = await request.json().catch(() => ({} as Body));

    // Honeypot anti-bot (si viene relleno, fingimos OK sin guardar)
    const honeypot = String(body.honeypot || '').trim();
    if (honeypot) {
      return NextResponse.json({ ok: true, message: 'Apuntado. Gracias, te contactamos pronto.' });
    }

    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const city = String(body.city || '').trim() || null;
    const role = String(body.role || '').trim() || null;
    const message = String(body.message || '').trim() || null;

    // IMPORTANTE: el front manda "wa"
    const rawPhone = String(body.wa || body.whatsapp || body.phone || '').trim();
    const phoneNorm = normalizeCOPhone(rawPhone);
    if (!phoneNorm.ok) {
      return NextResponse.json({ ok: false, error: phoneNorm.error }, { status: 400 });
    }
    const phone = phoneNorm.value; // null o string 10 dígitos

    if (!name || !email) {
      return NextResponse.json({ ok: false, error: 'Nombre y email son requeridos.' }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: 'Email inválido.' }, { status: 400 });
    }

    const referer = request.headers.get('referer') || '';
    const source =
      (String(body.source || '').trim() || (referer ? referer : 'landing')).slice(0, 500);

    // 1) Buscar si ya existe ese email
    const existingRes = await supabaseServer
      .from('leads')
      .select('id,email,name,city,role,phone,message,source')
      .eq('email', email)
      .maybeSingle();

    if (existingRes.error) {
      return NextResponse.json(
        { ok: false, error: `Database error: ${existingRes.error.message}` },
        { status: 500 }
      );
    }

    const existing = existingRes.data;

    // 2) Si existe, actualiza SOLO lo que cambie (incluye teléfono para corregir errores)
    if (existing) {
      const updates: Record<string, any> = {};

      if (name && name !== (existing.name || '')) updates.name = name;
      if (city !== null && city !== existing.city) updates.city = city;
      if (role !== null && role !== existing.role) updates.role = role;

      // clave: permitir añadir/corregir teléfono con el mismo email
      if (phone !== null && phone !== existing.phone) updates.phone = phone;

      // opcional: si antes no había message, o cambia
      if (message !== null && message !== existing.message) updates.message = message;

      // opcional: si source está vacío, lo rellenamos
      if ((!existing.source || existing.source === '') && source) updates.source = source;

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({
          ok: true,
          message: 'Ya estabas apuntado (ese email ya estaba registrado).',
          status: 'exists',
        });
      }

      const upd = await supabaseServer
        .from('leads')
        .update(updates)
        .eq('id', existing.id)
        .select('id,email')
        .single();

      if (upd.error) {
        return NextResponse.json(
          { ok: false, error: `Database error: ${upd.error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        message: 'Datos actualizados. Gracias, te contactamos pronto.',
        status: 'updated',
      });
    }

    // 3) Si no existe, inserta
    const ins = await supabaseServer
      .from('leads')
      .insert({
        name,
        email,
        city,
        role,
        phone, // null o 10 dígitos
        message,
        source,
      })
      .select('id,email')
      .single();

    if (ins.error) {
      // Por si hay carrera y ya existe (unique email)
      if ((ins.error as any).code === '23505') {
        return NextResponse.json({
          ok: true,
          message: 'Ya estabas apuntado (ese email ya estaba registrado).',
          status: 'exists',
        });
      }

      return NextResponse.json(
        { ok: false, error: `Database error: ${ins.error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Apuntado. Gracias, te contactamos pronto.',
      status: 'inserted',
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: `Server error: ${e?.message || 'unknown'}` },
      { status: 500 }
    );
  }
}
