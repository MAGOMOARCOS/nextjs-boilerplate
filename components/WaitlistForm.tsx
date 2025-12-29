'use client';

import { useState } from 'react';

type Status = 'idle' | 'loading' | 'inserted' | 'exists' | 'unknown' | 'error';


export default function WaitlistForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setMessage(null);

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || undefined, email: email.trim() }),
      });

      const data = (await res.json().catch(() => null)) as
        | { ok: true; status: 'inserted' | 'exists' | 'unknown'; id?: string | null }
        | { ok: false; error?: string };

      if (res.ok && data && (data as any).ok) {
        const st = (data as any).status as Status;
        setStatus(st === 'unknown' ? 'inserted' : st);
        setMessage(
          (data as any).status === 'exists'
            ? 'Ya estabas en la lista ✅'
            : '¡Listo! Te hemos apuntado ✅'
        );
        return;
      }

      setStatus('error');
      setMessage((data as any)?.error || 'Error al apuntarte. Intenta de nuevo.');
    } catch {
      setStatus('error');
      setMessage('Error de red. Intenta de nuevo.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="waitlist-form">
      <label>
        Nombre (opcional)
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre"
        />
      </label>

      <label>
        Correo electrónico
        <input
          required
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
        />
      </label>

      <button type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Enviando...' : 'Apuntarme'}
      </button>

      {message && <p className="message">{message}</p>}
    </form>
  );
}
