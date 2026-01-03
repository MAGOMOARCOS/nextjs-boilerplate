import { NextResponse } from 'next/server';
import { supabaseServer } from '@/app/lib/supabaseServer';

type Body = { name?: string; email?: string };

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    const body: Body = await request.json().catch(() => ({} as Body));
    const rawEmail = (body.email || '').trim();
    const name = (body.name || '').trim() || null;

    if (!rawEmail || !isValidEmail(rawEmail)) {
      return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 400 });
    }

    // Si ya tienes el RPC idempotente, úsalo:
    const { data, error } = await supabaseServer
      .rpc('waitlist_add_idempotent', { p_name: name, p_email: rawEmail });

    if (error) {
      console.error('waitlist rpc error', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (e: any) {
    console.error('waitlist POST error', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
