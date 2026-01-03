// app/api/leads/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/app/lib/supabaseServer";

export const runtime = "nodejs";

type Body = {
  name?: string;
  email?: string;
  city?: string;
  role?: string; // "Cocinero", "Consumidor", "Ambos", etc.
  phone?: string; // WhatsApp (Colombia) -> 10 dígitos
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Colombia: si se informa teléfono, debe ser EXACTAMENTE 10 dígitos (permitimos que el usuario escriba +57 y lo normalizamos)
function normalizeCOPhone(input: string): string | null {
  const digits = (input || "").replace(/\D/g, "");
  if (!digits) return null;

  let d = digits;

  // Permite +57XXXXXXXXXX (12 dígitos empezando por 57)
  if (d.length === 12 && d.startsWith("57")) d = d.slice(2);

  // Si alguien mete 0XXXXXXXXXX (11 dígitos empezando por 0), lo recortamos
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);

  if (d.length !== 10) {
    throw new Error("INVALID_CO_PHONE");
  }

  return d;
}

function getSource(request: Request): string {
  const ref = request.headers.get("referer") || request.headers.get("origin") || "";
  return ref || "landing";
}

export async function POST(request: Request) {
  try {
    const body: Body = await request.json().catch(() => ({} as Body));

    const email = (body.email || "").trim().toLowerCase();
    const name = (body.name || "").trim() || null;
    const city = (body.city || "").trim() || null;
    const role = (body.role || "").trim() || null;

    const rawPhone = (body.phone || "").trim();
    let phone: string | null = null;

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "Email inválido" },
        { status: 400 }
      );
    }

    // Teléfono opcional, pero si se informa debe ser válido (10 dígitos CO)
    try {
      phone = normalizeCOPhone(rawPhone);
    } catch {
      return NextResponse.json(
        { ok: false, error: "WhatsApp inválido: en Colombia deben ser 10 dígitos" },
        { status: 400 }
      );
    }

    const source = getSource(request);

    // 1) ¿Existe ya ese email?
    const existing = await supabaseServer
      .from("leads")
      .select("id, phone")
      .eq("email", email)
      .maybeSingle();

    if (existing.error) {
      // Si falla el select por algo real, abortamos
      console.error("[API /leads] select error:", existing.error);
      return NextResponse.json(
        { ok: false, error: "Database error" },
        { status: 500 }
      );
    }

    // 2) Si existe => UPDATE (para permitir corregir / completar teléfono, ciudad, etc.)
    if (existing.data) {
      const updatePayload: Record<string, any> = {};

      if (name) updatePayload.name = name;
      if (city) updatePayload.city = city;
      if (role) updatePayload.role = role;
      if (phone) updatePayload.phone = phone; // solo actualizamos si viene un teléfono válido
      if (source) updatePayload.source = source;

      if (Object.keys(updatePayload).length > 0) {
        const upd = await supabaseServer
          .from("leads")
          .update(updatePayload)
          .eq("id", existing.data.id);

        if (upd.error) {
          console.error("[API /leads] update error:", upd.error);
          return NextResponse.json(
            { ok: false, error: "Database error" },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({
        ok: true,
        status: "updated",
        message: "✅ Ya estabas apuntado. Hemos actualizado tus datos.",
      });
    }

    // 3) Si NO existe => INSERT
    const insertPayload: Record<string, any> = {
      email,
      source,
    };
    if (name) insertPayload.name = name;
    if (city) insertPayload.city = city;
    if (role) insertPayload.role = role;
    if (phone) insertPayload.phone = phone;

    const ins = await supabaseServer.from("leads").insert(insertPayload);

    // Race condition: si justo se insertó entre el select y el insert
    if (ins.error) {
      if (ins.error.code === "23505") {
        // Unique violation -> hacemos update y listo
        const updatePayload: Record<string, any> = {};
        if (name) updatePayload.name = name;
        if (city) updatePayload.city = city;
        if (role) updatePayload.role = role;
        if (phone) updatePayload.phone = phone;
        if (source) updatePayload.source = source;

        const upd2 = await supabaseServer
          .from("leads")
          .update(updatePayload)
          .eq("email", email);

        if (upd2.error) {
          console.error("[API /leads] update-after-23505 error:", upd2.error);
          return NextResponse.json(
            { ok: false, error: "Database error" },
            { status: 500 }
          );
        }

        return NextResponse.json({
          ok: true,
          status: "updated",
          message: "✅ Ya estabas apuntado. Hemos actualizado tus datos.",
        });
      }

      console.error("[API /leads] insert error:", ins.error);
      return NextResponse.json(
        { ok: false, error: "Database error" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: "inserted",
      message: "✅ Apuntado. Gracias, te contactamos pronto.",
    });
  } catch (err) {
    console.error("[API /leads] unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
