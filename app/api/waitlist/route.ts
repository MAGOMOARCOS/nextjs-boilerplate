import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  name?: string;
  email?: string;
  city?: string;
  role?: string;      // "cook" | "eat" | "both" (o como lo tengas)
  whatsapp?: string;  // opcional
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  const errId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);

  try {
    const body: Body = await req.json().catch(() => ({} as Body));

    const name = (body.name || '').trim() || null;
    const email = (body.email || '').trim().toLowerCase();
    const city = (body.city || '').trim() || null;
    const role = (body.role || '').trim() || null;
    const whatsapp = (body.whatsapp || '').trim() || null;

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // ✅ Preferido: RPC idempotente (evita duplicados)
    const rpc = await supabase.rpc('waitlist_add_idempotent', {
  p_email: email,
  p_name: name,
});


    if (rpc.error) {
      console.error('[waitlist]', { errId, where: 'rpc', error: rpc.error, env: process.env.VERCEL_ENV });
      return NextResponse.json(
        { ok: false, error: 'Internal server error', errId },
        { status: 500 }
      );
    }

    // Esperamos algo como: [{ status: 'inserted' | 'exists' }]
    const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
    const status = (row?.status as string) || 'ok';

    return NextResponse.json({ ok: true, status }, { status: 200 });
  } catch (e: any) {
    console.error('[waitlist]', { errId, where: 'catch', message: e?.message, stack: e?.stack, env: process.env.VERCEL_ENV });
    return NextResponse.json(
      { ok: false, error: 'Internal server error', errId },
      { status: 500 }
    );
  }
}
