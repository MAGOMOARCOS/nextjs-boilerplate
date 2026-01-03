import { NextResponse } from 'next/server';
import { supabaseServer } from '../../lib/supabaseServer';

export const runtime = 'nodejs';

type Body = {
  name?: unknown;
  email?: unknown;
  city?: unknown;
  role?: unknown;
  message?: unknown;

  // WhatsApp/phone (aceptamos varios nombres por compatibilidad)
  wa?: unknown;
  whatsapp?: unknown;
  whatsApp?: unknown;
  phone?: unknown;
  phoneNumber?: unknown;
  whatsappNumber?: unknown;
  whatsapp_phone?: unknown;
  whatsappPhone?: unknown;

  source?: unknown;
  honeypot?: unknown;
};

function cleanString(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}

function isValidEmail(email: string): boolean {
  // suficiente para landing (no valida dominio real, solo formato)
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function normalizePhoneCOStrict10(phoneRaw: string): string | null {
  // SOLO Colombia: 10 dígitos exactos (sin +57, sin 12, sin 8, sin margen)
  const digits = phoneRaw.replace(/\D/g, '');
  return digits.length === 10 ? digits : null;
}

export async function POST(request: Request) {
  try {
    const body: Body = await request.json().catch(() => ({} as Body));

    // Honeypot anti-bots (si viene relleno, no hacemos nada pero respondemos OK)
    const honeypot = cleanString(body.honeypot);
    if (honeypot) {
      return NextResponse.json({ ok: true, status: 'ignored', message: 'Gracias.' });
    }

    // Email (obligatorio)
    const emailRaw = cleanString(body.email)?.toLowerCase() ?? '';
    if (!emailRaw || !isValidEmail(emailRaw)) {
      return NextResponse.json({ ok: false, error: 'Email inválido.' }, { status: 400 });
    }

    // Campos opcionales
    const name = cleanString(body.name);
    const city = cleanString(body.city);
    const role = cleanString(body.role);
    const message = cleanString(body.message);

    const source =
      cleanString(body.source) ?? request.headers.get('referer') ?? 'landing';

    // WhatsApp (opcional pero si viene, debe ser válido)
    const phoneInput =
      cleanString(body.wa) ??
      cleanString(body.whatsapp) ??
      cleanString((body as any).whatsApp) ??
      cleanString(body.phone) ??
      cleanString((body as any).phoneNumber) ??
      cleanString((body as any).whatsappNumber) ??
      cleanString((body as any).whatsapp_phone) ??
      cleanString((body as any).whatsappPhone);

    const phone = phoneInput ? normalizePhoneCOStrict10(phoneInput) : null;

    if (phoneInput && !phone) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'WhatsApp inválido: en Colombia debe tener exactamente 10 dígitos (sin +57).',
        },
        { status: 400 }
      );
    }

    // 1) Mirar si ya existe el email
    const existing = await supabaseServer
      .from('leads')
      .select('id, name, city, role, phone, source')
      .eq('email', emailRaw)
      .limit(1);

    if (existing.error) {
      return NextResponse.json(
        { ok: false, error: `Database error: ${existing.error.message}` },
        { status: 500 }
      );
    }

    const row = existing.data?.[0] ?? null;

    // 2) Si existe: actualizar solo lo que venga informado (y distinto)
    if (row) {
      const patch: Record<string, any> = {};

      if (name && name !== row.name) patch.name = name;
      if (city && city !== row.city) patch.city = city;
      if (role && role !== row.role) patch.role = role;

      // message: si llega, lo guardamos (si prefieres NO sobreescribir, dímelo)
      if (message) patch.message = message;

      if (phone && phone !== row.phone) patch.phone = phone;

      // source: opcionalmente actualizar
      if (source && source !== row.source) patch.source = source;

      if (Object.keys(patch).length === 0) {
        return NextResponse.json({
          ok: true,
          status: 'exists',
          message: 'Ya estabas apuntado (ese email ya estaba registrado).',
        });
      }

      const upd = await supabaseServer
        .from('leads')
        .update(patch)
        .eq('id', row.id);

      if (upd.error) {
        return NextResponse.json(
          { ok: false, error: `Database error: ${upd.error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        status: 'updated',
        message: 'Ya estabas apuntado. Hemos actualizado tus datos.',
      });
    }

    // 3) Si NO existe: insertar
    const ins = await supabaseServer.from('leads').insert({
      email: emailRaw,
      name,
      city,
      role,
      phone, // null o 10 dígitos
      message,
      source,
    });

    if (ins.error) {
      // Carrera por unique email: si justo se insertó en paralelo, hacemos update
      if ((ins.error as any).code === '23505') {
        const patch: Record<string, any> = {};
        if (name) patch.name = name;
        if (city) patch.city = city;
        if (role) patch.role = role;
        if (message) patch.message = message;
        if (phone) patch.phone = phone;
        if (source) patch.source = source;

        if (Object.keys(patch).length) {
          await supabaseServer.from('leads').update(patch).eq('email', emailRaw);
          return NextResponse.json({
            ok: true,
            status: 'updated',
            message: 'Ya estabas apuntado. Hemos actualizado tus datos.',
          });
        }

        return NextResponse.json({
          ok: true,
          status: 'exists',
          message: 'Ya estabas apuntado (ese email ya estaba registrado).',
        });
      }

      return NextResponse.json(
        { ok: false, error: `Database error: ${ins.error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: 'created',
      message: 'Apuntado. Gracias, te contactamos pronto.',
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: `Unexpected error: ${e?.message ?? String(e)}` },
      { status: 500 }
    );
  }
}
