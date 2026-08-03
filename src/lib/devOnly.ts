import { NextResponse } from 'next/server';

/**
 * Cierra un endpoint de desarrollo en producción.
 *
 * Las rutas bajo /api/dev existen para probar mails y automatismos, y por diseño
 * NO piden sesión: se usan por curl desde localhost. El problema es que el
 * middleware sólo matchea /admin y /portal (ver `config.matcher` en
 * src/middleware.ts), así que en producción quedaban abiertas a cualquiera.
 *
 * Se responde 404 y no 403 a propósito: para alguien de afuera, un endpoint de
 * desarrollo no debería siquiera existir.
 *
 * Por qué esto y no `requireAdmin`: pedir sesión rompería el uso real de estas
 * rutas, que es curl sin login contra el server local. Cerrarlas en producción
 * conserva el flujo de desarrollo intacto y elimina la exposición.
 */
export function blockInProduction(): NextResponse | null {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return null;
}
