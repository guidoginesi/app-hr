'use client';

import { useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabaseClient';
import { Button } from '@pow/ui/components/ui/button';

// Logo de marca Pow arriba del acceso (mismo lockup que el login del portal).
const POW_LOGO = { src: '/brand/pow-logo-vertical.svg', className: 'mx-auto mb-2 h-28 w-auto' };

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }
      if (data?.user) {
        // Esperar un momento para que las cookies se establezcan, luego recarga completa.
        await new Promise((resolve) => setTimeout(resolve, 200));
        window.location.href = '/admin';
      } else {
        setError('No se pudo iniciar sesión');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error al iniciar sesión');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <img src={POW_LOGO.src} alt="Pow" className={POW_LOGO.className} />
          <span className="inline-block rounded-lg bg-secondary px-3 py-1 text-xs font-bold uppercase tracking-wider text-secondary-foreground">
            Administración
          </span>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-secondary-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-secondary-foreground">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 block w-full rounded-lg border border-[var(--border)] px-4 py-2.5 pr-10 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-danger-subtle p-3 text-sm text-[var(--red-600)]">
              {error}
            </div>
          )}

          <Button type="submit" size="lg" loading={loading} className="w-full">
            Ingresar
          </Button>
        </form>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Los usuarios deben estar agregados a la tabla de administradores.
        </p>
      </div>
    </div>
  );
}
