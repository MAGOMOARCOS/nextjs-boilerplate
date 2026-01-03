import { NextResponse } from 'next/server';
import { supabaseServer } from '@/app/lib/supabaseServer';

export const runtime = 'nodejs';

type LeadBody = {
  name?: string;
  email?: string;
  city?: string;
  role?: string;
  whatsapp?: string;
  wa?: string; // alias (el formulario envía "wa")
  honeypot?: string; // campo anti-bots
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
    const city = (body.city || '').trim() || null;
    const role = (body.role || '').trim() || null;
    // El formulario usa "wa"; dejamos compatibilidad con "whatsapp"
    const whatsapp = (body.wa || body.whatsapp || '').trim() || null;
    const source = (body.source || '').trim() || 'landing';

    // Anti-bots: si el honeypot viene relleno, respondemos OK pero no guardamos nada
    if ((body.honeypot || '').trim()) {
      return NextResponse.json({ ok: true, id: null }, { status: 200 });
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 400 });
    }

    // Ajusta las columnas a lo que existe en public.leads
    const payload: Record<string, any> = { email, source };
    if (name) payload.name = name;
    if (city) payload.city = city;
    if (role) payload.role = role;
    if (whatsapp) payload.whatsapp = whatsapp;

    // Service Role => inserta sin depender de RLS
    const { data, error } = await supabaseServer
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
