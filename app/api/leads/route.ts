import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/supabaseServer';

type Body = {
  name?: string;
  email?: string;
  city?: string;
  role?: string;
  wa?: string;
  honeypot?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    const body: Body = await request.json().catch(() => ({} as Body));

    // Honeypot: if filled, treat as spam
    if ((body.honeypot || '').trim()) {
      return NextResponse.json({ ok: true, message: 'OK' }, { status: 200 });
    }

    const rawEmail = (body.email || '').trim();
    const name = (body.name || '').trim() || null;
    const city = (body.city || '').trim() || null;
    const role = (body.role || '').trim() || null;
    const whatsapp = (body.wa || '').trim() || null;

    if (!rawEmail || !isValidEmail(rawEmail)) {
      return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 400 });
    }

    const payload: Record<string, any> = {
      email: rawEmail,
      source: 'landing',
      name,
      city,
      role,
      whatsapp,
    };

    const { error } = await supabaseServer.from('leads').insert(payload);

    if (error) {
      // Caso esperado: email duplicado
      if (error.code === '23505') {
        return NextResponse.json(
          { ok: true, message: '✅ Ya estabas apuntado (ese email ya estaba registrado).' },
          { status: 200 }
        );
      }

      console.error('leads insert error', error);
      return NextResponse.json({ ok: false, error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: '✅ Apuntado. Gracias, te contactamos pronto.' }, { status: 200 });
  } catch (e) {
    console.error('API /leads error', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
