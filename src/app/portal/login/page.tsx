'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseClient';

export default function PortalLoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <span className="inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-sm">
              Portal de Empleados
            </span>
            <h1 className="mt-6 text-2xl font-bold text-zinc-900">
              {resetSent ? '¡Email enviado!' : 'Recuperar contraseña'}
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              {resetSent 
                ? 'Revisá tu bandeja de entrada y seguí el link para configurar tu contraseña.'
                : 'Ingresá tu email y te enviaremos un link para configurar tu contraseña.'}
            </p>
          </div>

          {!resetSent ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-zinc-700">
                  Email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="tu@email.com"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isResetting}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                {isResetting ? 'Enviando...' : 'Enviar link de recuperación'}
              </button>
            </form>
          ) : (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-center">
              <p className="text-sm text-emerald-800">
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
            className="mt-6 w-full text-center text-sm text-zinc-600 hover:text-zinc-900"
          >
            ← Volver al login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-sm">
            Portal de Empleados
          </span>
          <h1 className="mt-6 text-2xl font-bold text-zinc-900">Iniciar sesión</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Ingresa con tu cuenta de empleado
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {isPending ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setShowResetForm(true)}
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
          >
            ¿Primera vez o no tenés contraseña?
          </button>
        </div>

        <p className="mt-8 text-center text-xs text-zinc-500">
          ¿Sos administrador?{' '}
          <a href="/admin/login" className="font-medium text-emerald-600 hover:text-emerald-700">
            Ir al panel de admin
          </a>
        </p>
      </div>
    </div>
  );
}
