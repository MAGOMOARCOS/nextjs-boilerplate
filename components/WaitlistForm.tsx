import React, { useState } from 'react';

export default function WaitlistForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'inserted' | 'exists' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setMessage(null);

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name || null, email }),
      });

      const json = await res.json();

      if (res.ok && json.ok) {
        if (json.status === 'inserted') {
          setStatus('inserted');
          setMessage('¡Listo! Te avisaremos.');
        } else if (json.status === 'exists') {
          setStatus('exists');
          setMessage('Ya estabas apuntado.');
        } else {
          setStatus('error');
          setMessage('Algo inesperado ocurrió. Intenta más tarde.');
        }
      } else {
        setStatus('error');
        setMessage(json?.error ?? 'Error al enviar. Intenta más tarde.');
      }
    } catch (err) {
      setStatus('error');
      setMessage('Error de red. Intenta de nuevo.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="waitlist-form">
      <label>
        Nombre (opcional)
        <input name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />
      </label>

      <label>
        Correo electrónico
        <input required name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
      </label>

      <button type="submit" disabled={status === 'loading'}>{status === 'loading' ? 'Enviando...' : 'Apuntarme'}</button>

      {message && <p className="message">{message}</p>}
    </form>
  );
}
