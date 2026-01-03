// app/api/leads/route.ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/app/lib/supabaseServer';

type Body = {
  name?: string;
  email?: string;
  city?: string;
  role?: string;
  phone?: string;
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Acepta: "+57 3001234567" / "0034 600..." / "600123456" (7–15 dígitos)
// Rechaza: letras, demasiados dígitos, símbolos raros.
function normalizePhone(raw: string): string | null {
  const s0 = (raw || '').trim();
  if (!s0) return null;

  // quita espacios y separadores típicos
  let s = s0.replace(/[\s().-]/g, '');

  // 00XX -> +XX
  if (s.startsWith('00')) s = '+' + s.slice(2);

  const hasPlus = s.startsWith('+');
  const digits = hasPlus ? s.slice(1) : s;

  if (!/^\d+$/.test(digits)) return null;
  if (digits.length < 7 || digits.length > 15) return null;

  return hasPlus ? `+${digits}` : digits;
}

function cleanText(raw: unknown, maxLen: number): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function normalizeRole(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;

  // Permite tus valores actuales; si llega otro, lo guardamos igual (capado).
  const allowed = new Set([
    'Ambos',
    'Cocinero (quiero vender)',
    'Cliente (quiero comer)',
    'Cocinero',
    'Cliente',
  ]);

  if (allowed.has(s)) return s;
  return s.length > 50 ? s.slice(0, 50) : s;
}

export async function POST(request: Request) {
  try {
    const body: Body = await request.json().catch(() => ({} as Body));

    const email = cleanText(body.email, 254)?.toLowerCase() ?? null;
    const name = cleanText(body.name, 120);
    const city = cleanText(body.city, 120);
    const role = normalizeRole(body.role);

    // Si el usuario manda phone vacío, no lo usamos para actualizar (solo se actualiza si viene válido).
    const rawPhone = String(body.phone ?? '').trim();
    const phone = rawPhone ? normalizePhone(rawPhone) : null;

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: 'Email inválido.' },
        { status: 400 }
      );
    }

    if (rawPhone && !phone) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'WhatsApp inválido. Usa solo números (7–15 dígitos) y opcional +prefijo (ej: +57 3001234567).',
        },
        { status: 400 }
      );
    }

    const source = 'landing';

    // 1) ¿Existe ya ese email?
    const { data: existingRows, error: selErr } = await supabaseServer
      .from('leads')
      .select('id, name, city, role, phone')
      .eq('email', email)
      .limit(1);

    if (selErr) {
      console.error('[API /leads] select error:', selErr);
      return NextResponse.json(
        { ok: false, error: 'Database error' },
        { status: 500 }
      );
    }

    const existing = existingRows?.[0] ?? null;

    // 2) Si existe: actualiza campos corregibles (incluido WhatsApp) y devuelve mensaje OK
    if (existing) {
      const updates: Record<string, any> = {};

      if (name && name !== existing.name) updates.name = name;
      if (city && city !== existing.city) updates.city = city;
      if (role && role !== existing.role) updates.role = role;

      // Solo actualiza el teléfono si el usuario lo envía y es válido
      if (phone && phone !== existing.phone) updates.phone = phone;

      // opcional: refrescar source si quieres
      // updates.source = source;

      if (Object.keys(updates).length > 0) {
        const { error: updErr } = await supabaseServer
          .from('leads')
          .update(updates)
          .eq('email', email);

        if (updErr) {
          console.error('[API /leads] update error:', updErr);
          return NextResponse.json(
            { ok: false, error: 'Database error' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          ok: true,
          message: '✅ Ya estabas apuntado, y hemos actualizado tus datos.',
        });
      }

      return NextResponse.json({
        ok: true,
        message: '✅ Ya estabas apuntado (ese email ya estaba registrado).',
      });
    }

    // 3) Si NO existe: inserta
    const insertRow: Record<string, any> = {
      email,
      name,
      city,
      role,
      phone,
      source,
    };

    const { error: insErr } = await supabaseServer.from('leads').insert(insertRow);

    if (insErr) {
      // Carrera: si justo se insertó en paralelo, tratamos como "ya estaba" y actualizamos si procede.
      if (insErr.code === '23505') {
        const updates: Record<string, any> = {};
        if (name) updates.name = name;
        if (city) updates.city = city;
        if (role) updates.role = role;
        if (phone) updates.phone = phone;

        if (Object.keys(updates).length > 0) {
          await supabaseServer.from('leads').update(updates).eq('email', email);
          return NextResponse.json({
            ok: true,
            message: '✅ Ya estabas apuntado, y hemos actualizado tus datos.',
          });
        }

        return NextResponse.json({
          ok: true,
          message: '✅ Ya estabas apuntado (ese email ya estaba registrado).',
        });
      }

      console.error('[API /leads] insert error:', insErr);
      return NextResponse.json(
        { ok: false, error: 'Database error' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: '✅ Apuntado. Gracias, te contactamos pronto.',
    });
  } catch (err) {
    console.error('[API /leads] unexpected error:', err);
    return NextResponse.json(
      { ok: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
