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
  const errId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

  try {
    const body: Body = await req.json().catch(() => ({} as Body));

    const name = (body.name || '').trim() || null;
    const email = (body.email || '').trim().toLowerCase();

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const rpc = await supabase.rpc('waitlist_add_idempotent', {
      p_email: email,
      p_name: name,
    });

    if (rpc.error) {
      // ✅ TEMP DEBUG: devolvemos el error real (quítalo cuando esté OK)
      console.error('[waitlist]', { errId, where: 'rpc', error: rpc.error, env: process.env.VERCEL_ENV });
      return NextResponse.json(
        {
          ok: false,
          error: 'RPC error',
          errId,
          rpc_error: {
            code: rpc.error.code,
            message: rpc.error.message,
            details: rpc.error.details,
            hint: rpc.error.hint,
          },
        },
        { status: 500 }
      );
    }

    const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
    const status = (row?.status as string) || 'inserted';

    return NextResponse.json({ ok: true, status }, { status: 200 });
  } catch (e: any) {
    // ✅ TEMP DEBUG: devolvemos el mensaje real
    console.error('[waitlist]', { errId, where: 'catch', message: e?.message, stack: e?.stack, env: process.env.VERCEL_ENV });
    return NextResponse.json(
      { ok: false, error: 'Catch error', errId, message: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
