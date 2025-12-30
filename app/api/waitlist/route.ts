import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  name?: string;
  email?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  const errId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    const body = (await req.json().catch(() => ({} as Body))) as Body;

    const rawEmail = String(body.email ?? '').trim().toLowerCase();
    const name = String(body.name ?? '').trim() || null;

    if (!rawEmail || !isValidEmail(rawEmail)) {
      return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // ✅ SOLO los 2 params que existen en tu SQL: (p_email, p_name)
    const rpc = await supabase
      .rpc('waitlist_add_idempotent', { p_email: rawEmail, p_name: name })
      .throwOnError();

    const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
    const status = (row?.status as string) || 'ok';

    return NextResponse.json({ ok: true, status }, { status: 200 });
  } catch (e: any) {
    console.error('[waitlist]', {
      errId,
      where: 'catch',
      message: e?.message,
      stack: e?.stack,
      env: process.env.VERCEL_ENV,
    });
    return NextResponse.json({ ok: false, error: 'Internal server error', errId }, { status: 500 });
  }
}
