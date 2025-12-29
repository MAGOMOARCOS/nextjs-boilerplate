import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';

export const runtime = 'nodejs';

type LeadBody = {
  name?: string;
  email?: string;
  message?: string;
  phone?: string;
  source?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  try {
    const body: LeadBody = await req.json().catch(() => ({} as LeadBody));

    const email = (body.email || '').trim();
    const name = (body.name || '').trim() || null;
    const message = (body.message || '').trim() || null;
    const phone = (body.phone || '').trim() || null;
    const source = (body.source || '').trim() || 'landing';

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Inserta solo campos comunes. Si tu tabla tiene más columnas, las añades luego.
    const payload: Record<string, any> = {
      email,
      source,
    };
    if (name) payload.name = name;
    if (message) payload.message = message;
    if (phone) payload.phone = phone;

    const { data, error } = await supabase
      .from('leads')
      .insert(payload)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('leads insert error', error);
      return NextResponse.json({ ok: false, error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: (data as any)?.id ?? null }, { status: 200 });
  } catch (e) {
    console.error('leads route error', e);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, error: 'Method Not Allowed' }, { status: 405 });
}
