import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  name?: string;
  email?: string;
  city?: string;
  role?: string;
  whatsapp?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  const errId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    const body: Body = await request.json().catch(() => ({} as Body));

    const email = (body.email || '').trim();
    const name = (body.name || '').trim() || null;
    const city = (body.city || '').trim() || null;
    const role = (body.role || '').trim() || null;
    const whatsapp = (body.whatsapp || '').trim() || null;

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const rpc = await supabase
      .rpc('waitlist_add_idempotent', {
        p_city: city,
        p_email: email,
        p_name: name,
        p_role: role,
        p_whatsapp: whatsapp,
      })
      .throwOnError();

    const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
    const status = (row?.status as string) || 'inserted';

    return NextResponse.json({ ok: true, status }, { status: 200 });
  } catch (e: any) {
    console.error('[waitlist]', {
      errId,
      where: 'catch',
      message: e?.message,
      stack: e?.stack,
      env: process.env.VERCEL_ENV,
    });

    return NextResponse.json(
      { ok: false, error: 'Internal server error', errId },
      { status: 500 }
    );
  }
}
