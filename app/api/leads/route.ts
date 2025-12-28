cd /workspaces/nextjs-boilerplate

cat > app/api/leads/route.ts <<'EOF'
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";

export const runtime = "nodejs";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  let body: any;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const website = String(body?.website ?? "").trim(); // honeypot
  if (website) {
    // silencioso anti-spam
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const city = String(body?.city ?? "").trim();
  const interest = String(body?.interest ?? "").trim();
  const whatsapp = String(body?.whatsapp ?? "").trim();

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
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from("leads").insert([
      {
        name,
        email,
        city,
        interest,
        whatsapp: whatsapp || null,
      },
    ]);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
EOF
