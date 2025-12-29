import { NextResponse } from 'next/server';
import { supabaseServer } from '../../lib/supabaseServer';

type Body = {
  name?: string;
  email?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  // Parsear 1 sola vez (nunca vuelvas a leer el body)
  const body: Body = await request.json().catch(() => ({} as Body));
  const rawEmail = (body.email || '').trim();
  const name = (body.name || '').trim() || null;

  if (!rawEmail || !isValidEmail(rawEmail)) {
    return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 400 });
  }

  try {
    // 1) Intento principal: RPC idempotente
    try {
      const rpc = await supabaseServer
        .rpc('waitlist_add_idempotent', { p_name: name, p_email: rawEmail })
        .throwOnError();

      const rows = rpc.data as Array<{ status: string; waitlist_id: string }>;
      const row = rows?.[0] ?? null;

      if (row) {
        return NextResponse.json({
          ok: true,
          status: row.status === 'inserted' ? 'inserted' : 'exists',
          id: row.waitlist_id ?? null,
        });
      }
    } catch {
      // seguimos al fallback
    }

    // 2) Fallback: insert directo
    const insert = await supabaseServer
      .from('waitlist')
      .insert({ name, email: rawEmail })
      .select('id')
      .throwOnError()
      .maybeSingle();

    if ((insert.data as any)?.id) {
      return NextResponse.json({ ok: true, status: 'inserted', id: (insert.data as any).id });
    }

    // 3) Fallback: buscar existente (case-insensitive)
    const existing = await supabaseServer
      .from('waitlist')
      .select('id')
      .ilike('email', rawEmail)
      .limit(1)
      .maybeSingle();

    if ((existing.data as any)?.id) {
      return NextResponse.json({ ok: true, status: 'exists', id: (existing.data as any).id });
    }

    return NextResponse.json({ ok: false, error: 'Could not add to waitlist' }, { status: 500 });
  } catch (err: any) {
    const pgCode = err?.code ?? err?.error?.code ?? null;

    // Duplicado por índice unique(lower(email))
    if (pgCode === '23505') {
      try {
        const existing = await supabaseServer
          .from('waitlist')
          .select('id')
          .ilike('email', rawEmail)
          .limit(1)
          .maybeSingle();

        return NextResponse.json({ ok: true, status: 'exists', id: (existing.data as any)?.id ?? null });
      } catch {
        return NextResponse.json({ ok: true, status: 'exists', id: null });
      }
    }

    console.error('waitlist POST error', err);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
