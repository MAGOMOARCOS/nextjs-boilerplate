import { NextResponse } from 'next/server';
import { supabaseServer } from '../../lib/supabaseServer';

type Body = {
  name?: string;
  email?: string;
  city?: string;
  interest?: string;   // “Ambos”, “Cocinero”, etc.
  whatsapp?: string;
  source?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    const body: Body = await request.json().catch(() => ({} as Body));

    const email = (body.email || '').trim().toLowerCase();
    const name = (body.name || '').trim() || null;
    const city = (body.city || '').trim() || null;
    const interest = (body.interest || '').trim() || null;
    const whatsapp = (body.whatsapp || '').trim() || null;

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 400 });
    }

    const source = (body.source || request.headers.get('referer') || '').trim() || null;

    // Idempotente por email (requiere UNIQUE(email))
    const { data, error } = await supabaseServer
      .from('leads')
      .upsert(
        { name, email, city, interest, whatsapp, source },
        { onConflict: 'email' }
      )
      .select('id')
      .single();

    if (error) {
      console.error('[API /leads] Supabase error:', error);
      return NextResponse.json({ ok: false, error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data?.id }, { status: 200 });
  } catch (e) {
    console.error('[API /leads] Unexpected error:', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
