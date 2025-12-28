import { NextRequest, NextResponse } from 'next/server';
import supabase from '../../../lib/supabaseClient';

export async function POST(request: NextRequest) {
  try {
    const { name, email, city, role, wa, honeypot } = await request.json();

    // Honeypot check
    if (honeypot) {
      return NextResponse.json({ error: 'Spam detected' }, { status: 400 });
    }

    // Basic validation
    if (!name || !email) {
      return NextResponse.json({ error: 'Nombre y email son requeridos' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
    }

    // Insert into Supabase
    const { error } = await supabase
      .from('leads')
      .insert([{ name, email, city: city || 'Medellín', role: role || 'Ambos', wa }]);

    if (error) {
      console.error('Error inserting lead:', error);
      return NextResponse.json({ error: 'Error al guardar el lead' }, { status: 500 });
    }

    return NextResponse.json({ message: '¡Gracias! Estás en la lista' });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}