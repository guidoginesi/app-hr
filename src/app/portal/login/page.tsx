'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@pow/ui/components/ui/button';
import { getSupabaseBrowser } from '@/lib/supabaseClient';

export default function PortalLoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const supabase = getSupabaseBrowser();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError('Email o contraseña incorrectos');
      return;
    }

    startTransition(() => {
      router.replace('/portal');
      router.refresh();
    });
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsResetting(true);

    try {
      const res = await fetch('/api/auth/request-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Error al enviar el email');
        return;
      }

      setResetSent(true);
    } catch (err) {
      setError('Error de conexión. Intentá de nuevo.');
    } finally {
      setIsResetting(false);
    }
  }

  // Reset password form
  if (showResetForm) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <span className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-sm">
              Portal de Empleados
            </span>
            <h1 className="mt-6 text-2xl font-bold text-foreground">
              {resetSent ? '¡Email enviado!' : 'Recuperar contraseña'}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {resetSent 
                ? 'Revisá tu bandeja de entrada y seguí el link para configurar tu contraseña.'
                : 'Ingresá tu email y te enviaremos un link para configurar tu contraseña.'}
            </p>
          </div>

          {!resetSent ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-secondary-foreground">
                  Email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="tu@email.com"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-danger-subtle p-3 text-sm text-[var(--red-600)]">
                  {error}
                </div>
              )}

              <Button type="submit" size="lg" loading={isResetting} className="w-full">
                Enviar link de recuperación
              </Button>
            </form>
          ) : (
            <div className="rounded-lg border border-success/30 bg-success-subtle p-4 text-center">
              <p className="text-sm text-[var(--green-700)]">
                Email enviado a <strong>{email}</strong>
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setShowResetForm(false);
              setResetSent(false);
              setError(null);
            }}
            className="mt-6 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            ← Volver al login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-sm">
            Portal de Empleados
          </span>
          <h1 className="mt-6 text-2xl font-bold text-foreground">Iniciar sesión</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ingresa con tu cuenta de empleado
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <Button type="submit" size="lg" loading={isPending} className="w-full">
            Ingresar
          </Button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setShowResetForm(true)}
            className="text-sm text-foreground hover:text-[var(--primary-hover)] font-medium"
          >
            ¿Primera vez o no tenés contraseña?
          </button>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          ¿Sos administrador?{' '}
          <a href="/admin/login" className="font-medium text-foreground hover:text-[var(--primary-hover)]">
            Ir al panel de admin
          </a>
        </p>
      </div>
    </div>
  );
}
