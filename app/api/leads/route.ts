// app/api/leads/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '../../lib/supabaseServer';

type Body = {
  name?: string;
  email?: string;
  city?: string;
  role?: string;

  // WhatsApp/phone (front manda "wa")
  wa?: string;
  whatsapp?: string;
  phone?: string;

  // antispam
  honeypot?: string;
  hp?: string;
  website?: string;

  // opcional
  source?: string;
};

function norm(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return s ? s : null;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeCoPhoneStrict10(raw: string | null): { phone: string | null; error?: string } {
  if (!raw) return { phone: null };

  const digits = raw.replace(/[^\d]/g, '');

  // Colombia: exactamente 10 dígitos (sin +57)
  if (digits.startsWith('57') && digits.length === 12) {
    return { phone: null, error: 'WhatsApp debe tener 10 dígitos. No incluyas +57 (solo el número local).' };
  }
  if (digits.length !== 10) {
    return { phone: null, error: 'WhatsApp debe tener exactamente 10 dígitos (Colombia).' };
  }
  return { phone: digits };
}

export async function POST(request: Request) {
  try {
    const body: Body = await request.json().catch(() => ({} as Body));

    // Honeypot anti-bots: respondemos OK pero NO guardamos
    const honeypot = norm(body.honeypot) ?? norm(body.hp) ?? norm(body.website);
    if (honeypot) {
      return NextResponse.json(
        { ok: true, message: '¡Listo! Te avisaremos cuando abramos la beta.' },
        { status: 200 }
      );
    }

    const emailRaw = (body.email ?? '').trim().toLowerCase();
    if (!emailRaw || !isValidEmail(emailRaw)) {
      return NextResponse.json({ ok: false, error: 'Email inválido.' }, { status: 400 });
    }

    const name = norm(body.name);
    const city = norm(body.city);
    const role = norm(body.role);

    const waRaw = norm(body.wa) ?? norm(body.whatsapp) ?? norm(body.phone);
    const phoneCheck = normalizeCoPhoneStrict10(waRaw);
    if (phoneCheck.error) {
      return NextResponse.json({ ok: false, error: phoneCheck.error }, { status: 400 });
    }

    const source =
      norm(body.source) ??
      (request.headers.get('referer') ? request.headers.get('referer')!.slice(0, 250) : null) ??
      'landing';

    // Insertamos. Si el email ya existe, actualizamos (para permitir corregir WhatsApp, ciudad, rol, nombre).
    const insertRow: Record<string, any> = {
      email: emailRaw,
      source,
    };
    if (name) insertRow.name = name;
    if (city) insertRow.city = city;
    if (role) insertRow.role = role;
    if (phoneCheck.phone) insertRow.phone = phoneCheck.phone;

    const ins = await supabaseServer.from('leads').insert(insertRow).select('id').single();

    if (!ins.error) {
      return NextResponse.json(
        { ok: true, message: '✅ Apuntado. Gracias, te contactamos pronto.' },
        { status: 200 }
      );
    }

    // Duplicado por UNIQUE(email) => actualizamos lo que venga (sin “guardar” teléfonos inválidos: ya se validó arriba)
    if ((ins.error as any)?.code === '23505') {
      const updateRow: Record<string, any> = { source };

      // Solo actualizamos campos si vienen informados (no machacamos con null)
      if (name) updateRow.name = name;
      if (city) updateRow.city = city;
      if (role) updateRow.role = role;
      if (phoneCheck.phone) updateRow.phone = phoneCheck.phone;

      // Si no hay nada que actualizar, devolvemos “ya estabas”
      const keys = Object.keys(updateRow).filter((k) => k !== 'source');
      if (keys.length === 0) {
        return NextResponse.json(
          { ok: true, message: '✅ Ya estabas apuntado (ese email ya estaba registrado).' },
          { status: 200 }
        );
      }

      const upd = await supabaseServer.from('leads').update(updateRow).eq('email', emailRaw);

      if (upd.error) {
        console.error('leads update error', upd.error);
        return NextResponse.json(
          { ok: false, error: upd.error.message ?? 'Database error' },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { ok: true, message: '✅ Ya estabas apuntado. Hemos actualizado tus datos.' },
        { status: 200 }
      );
    }

    console.error('leads insert error', ins.error);
    return NextResponse.json(
      { ok: false, error: ins.error.message ?? 'Database error' },
      { status: 500 }
    );
  } catch (err) {
    console.error('[API /leads] Unexpected error:', err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
