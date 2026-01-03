import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/supabaseServer';

type Body = {
  name?: string;
  email?: string;
  city?: string;
  role?: string;
  wa?: string;       // WhatsApp (opcional) desde el formulario
  honeypot?: string; // antispam
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    const body: Body = await request.json().catch(() => ({} as Body));

    // Honeypot: si viene relleno => spam silencioso (200 OK)
    if ((body.honeypot || '').trim()) {
      return NextResponse.json({ ok: true, message: 'OK' }, { status: 200 });
    }

    const rawEmail = (body.email || '').trim();
    const name = (body.name || '').trim();
    const city = (body.city || '').trim();
    const role = (body.role || '').trim();
    const phone = (body.wa || '').trim();

    if (!rawEmail || !isValidEmail(rawEmail)) {
      return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 400 });
    }

    // Payload de inserción (NO incluyas created_at; que lo ponga la DB)
    const insertPayload: Record<string, any> = {
      email: rawEmail,
      source: 'landing',
      name: name || null,
      city: city || null,
      role: role || null,
      phone: phone || null,
    };

    const { error: insertError } = await supabaseServer.from('leads').insert(insertPayload);

    // OK -> insertado
    if (!insertError) {
      return NextResponse.json(
        { ok: true, message: '✅ Apuntado. Gracias, te contactamos pronto.' },
        { status: 200 }
      );
    }

    // Duplicado -> actualizar (permite corregir datos)
    if (insertError.code === '23505') {
      // Para no “pisar” con null si el usuario deja un campo vacío,
      // solo actualizamos lo que venga con valor.
      const patch: Record<string, any> = { source: 'landing' };

      if (name) patch.name = name;
      if (city) patch.city = city;
      if (role) patch.role = role;
      if (phone) patch.phone = phone;

      const { error: updateError } = await supabaseServer
        .from('leads')
        .update(patch)
        .eq('email', rawEmail);

      if (updateError) {
        console.error('leads update error', updateError);
        return NextResponse.json({ ok: false, error: 'Database error' }, { status: 500 });
      }

      return NextResponse.json(
        { ok: true, message: '✅ Ya estabas apuntado. Hemos actualizado tus datos.' },
        { status: 200 }
      );
    }

    // Otro error real
    console.error('leads insert error', insertError);
    return NextResponse.json({ ok: false, error: 'Database error' }, { status: 500 });
  } catch (e) {
    console.error('API /leads error', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
