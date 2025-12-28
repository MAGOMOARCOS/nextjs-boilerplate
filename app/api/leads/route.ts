import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";

export const runtime = "nodejs";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim();
  const city = String(body?.city ?? "").trim();
  const interest = String(body?.interest ?? "").trim();
  const whatsapp = String(body?.whatsapp ?? "").trim();
  const website = String(body?.website ?? "").trim(); // honeypot

  // Honeypot: si viene relleno, respondemos OK y no guardamos
  if (website.length > 0) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Validación básica
  if (name.length < 2) {
    return NextResponse.json({ ok: false, error: "Name too short" }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
  }
  if (!city) {
    return NextResponse.json({ ok: false, error: "City is required" }, { status: 400 });
  }
  if (!interest) {
    return NextResponse.json({ ok: false, error: "Interest is required" }, { status: 400 });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { error } = await supabaseAdmin.from("leads").insert([
      { name, email, city, interest, whatsapp },
    ]);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
