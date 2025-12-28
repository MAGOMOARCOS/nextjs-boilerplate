'use client';

import { useRef, useState } from 'react';

export default function Home() {
  const formRef = useRef<HTMLDivElement | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name') || '').trim();
    const email = String(fd.get('email') || '').trim();
    const city = String(fd.get('city') || 'Medellín').trim() || 'Medellín';
    const role = String(fd.get('role') || 'Ambos');
    const wa = String(fd.get('wa') || '').trim();
    const honeypot = String(fd.get('honeypot') || '').trim();

    // Basic client validation
    if (!name || !email) {
      setError('Nombre y email son requeridos');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Email inválido');
      return;
    }

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, city, role, wa, honeypot }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error al enviar el formulario');
    }
  }

  return (
    <>
      <style jsx global>{`
        :root{--bg:#0b0c10;--card:#12141b;--txt:#e9eefb;--muted:#aab3c5;--acc:#ff8a00;--ok:#39d98a}
        *{box-sizing:border-box}
        body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,"Helvetica Neue",Arial;background:radial-gradient(1200px 800px at 20% 0%,#1a1f2b 0%,var(--bg) 55%),var(--bg);color:var(--txt)}
        a{color:inherit}
        .wrap{max-width:980px;margin:0 auto;padding:28px 18px 60px}
        .top{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}
        .brand{display:flex;align-items:center;gap:10px}
        .logo{width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,var(--acc),#ffd27a);display:grid;place-items:center;color:#111;font-weight:900}
        .pill{font-size:12px;color:#111;background:#ffd27a;border-radius:999px;padding:6px 10px;font-weight:700}
        .hero{margin-top:18px;display:grid;grid-template-columns:1.2fr .8fr;gap:16px}
        @media(max-width:860px){.hero{grid-template-columns:1fr}}
        .card{background:rgba(18,20,27,.82);border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:18px;backdrop-filter:blur(6px)}
        h1{font-size:36px;line-height:1.1;margin:8px 0 10px}
        p{margin:0 0 10px;color:var(--muted);font-size:16px;line-height:1.5}
        .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}
        @media(max-width:860px){.grid3{grid-template-columns:1fr}}
        .k{padding:12px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)}
        .k b{display:block;color:var(--txt);margin-bottom:4px}
        .cta{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
        button{border:0;border-radius:12px;padding:12px 14px;font-weight:800;cursor:pointer}
        .primary{background:var(--acc);color:#111}
        .ghost{background:transparent;border:1px solid rgba(255,255,255,.18);color:var(--txt)}
        label{display:block;font-weight:700;margin:10px 0 6px}
        input,select{width:100%;padding:12px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:#0f1118;color:var(--txt);outline:none}
        .row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        @media(max-width:860px){.row{grid-template-columns:1fr}}
        .small{font-size:12px;color:var(--muted);margin-top:10px}
        .ok{margin-top:10px;padding:10px 12px;border-radius:12px;background:rgba(57,217,138,.12);border:1px solid rgba(57,217,138,.35);color:var(--ok);font-weight:800}
        footer{margin-top:18px;color:var(--muted);font-size:12px}
        .links{display:flex;gap:12px;flex-wrap:wrap;margin-top:8px}
        .links a{opacity:.9}
      `}</style>

      <div className="wrap">
        <div className="top">
          <div className="brand">
            <div className="logo">CV</div>
            <div>
              <div style={{ fontWeight: 900 }}>Cocina Vecinal</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Comida casera entre vecinos — Medellín primero
              </div>
            </div>
          </div>
          <div className="pill">Lista de espera (pre-lanzamiento)</div>
        </div>

        <div className="hero">
          <div className="card">
            <h1>Si cocinas en casa, puedes vender. Si no te apetece cocinar, puedes pedir.</h1>
            <p>
              Cocina Vecinal conecta <b>cocinas caseras</b> con vecinos que quieren <b>comida asequible y real</b>.
              Cada persona puede ser <b>oferta</b> y <b>demanda</b> según el día.
            </p>

            <div className="grid3">
              <div className="k"><b>Recogida</b><span>Quedas con tu vecino y recoges.</span></div>
              <div className="k"><b>Entrega</b><span>El cocinero entrega (tarifa por tramos).</span></div>
              <div className="k"><b>Comer en casa</b><span>Opción “anfitrión” (si el cocinero la habilita).</span></div>
            </div>

            <div className="cta">
              <button className="primary" onClick={scrollToForm}>Unirme a la lista de espera</button>
              <button
                className="ghost"
                onClick={() => (window.location.href = 'mailto:info@cocinavecinal.com?subject=Contacto%20Cocina%20Vecinal')}
              >
                Contactar
              </button>
            </div>

            <footer>
              <b>Nota:</b> esto es una página temporal para captación y validación. La app se lanza en ~90 días.
              <div className="links">
                <a href="mailto:info@cocinavecinal.com">info@cocinavecinal.com</a>
              </div>
            </footer>
          </div>

          <div className="card" ref={formRef}>
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>Únete a la lista de espera</div>
            <p style={{ marginBottom: 12 }}>Te avisaremos cuando abramos en Medellín. (Sin spam)</p>

            <form onSubmit={handleSubmit}>
              <div className="row">
                <div>
                  <label>Nombre</label>
                  <input name="name" required placeholder="Tu nombre" />
                </div>
                <div>
                  <label>Email</label>
                  <input name="email" type="email" required placeholder="tu@email.com" />
                </div>
              </div>

              <div className="row">
                <div>
                  <label>Ciudad</label>
                  <input name="city" placeholder="Medellín" />
                </div>
                <div>
                  <label>Me interesa como</label>
                  <select name="role" defaultValue="Ambos">
                    <option value="Consumidor">Consumidor (quiero pedir)</option>
                    <option value="Cocinero">Cocinero (quiero vender)</option>
                    <option value="Ambos">Ambos</option>
                  </select>
                </div>
              </div>

              <label>WhatsApp (opcional)</label>
              <input name="wa" placeholder="+57 ..." />

              <input name="honeypot" type="text" style={{ display: 'none' }} />

              <div className="cta" style={{ marginTop: 12 }}>
                <button className="primary" type="submit">Apuntarme</button>
              </div>

              {message && <div className="ok">{message}</div>}
              {error && <div style={{ color: 'red', marginTop: 10 }}>{error}</div>}

              <div className="small">
                Tus datos se guardarán de forma segura.
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
