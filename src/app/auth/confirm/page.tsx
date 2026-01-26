'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseClient';
import { Suspense } from 'react';

function AuthConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Procesando tu acceso...');

  useEffect(() => {
    const handleAuth = async () => {
      const supabase = getSupabaseBrowser();
      
      // Check for token_hash and type in URL params (Supabase PKCE flow)
      const tokenHash = searchParams.get('token_hash');
      const type = searchParams.get('type');
      
      if (tokenHash && type) {
        // Verify the OTP token
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as 'recovery' | 'invite' | 'email',
        });

        if (error) {
          console.error('Error verifying token:', error);
          setStatus('error');
          setMessage('El enlace ha expirado o no es válido. Solicitá uno nuevo.');
          return;
        }

        // Successfully verified - redirect to set password
        if (type === 'recovery' || type === 'invite') {
          setStatus('success');
          setMessage('¡Perfecto! Redirigiendo para configurar tu contraseña...');
          setTimeout(() => {
            router.push('/auth/set-password');
          }, 1500);
          return;
        }
        
        // Email verification
        setStatus('success');
        setMessage('¡Email verificado! Redirigiendo...');
        setTimeout(() => {
          router.push('/portal');
        }, 1500);
        return;
      }

      // Check if we have a hash with access_token (from invite/magic link emails - legacy format)
      const hash = window.location.hash;
      
      if (hash && hash.includes('access_token')) {
        // Parse the hash fragment
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const hashType = params.get('type');

        if (accessToken && refreshToken) {
          // Set the session
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error('Error setting session:', error);
            setStatus('error');
            setMessage('Error al procesar tu acceso. Por favor, intenta de nuevo.');
            return;
          }

          // Check if this is an invite or recovery (user needs to set password)
          if (hashType === 'invite' || hashType === 'recovery') {
            setStatus('success');
            setMessage('¡Perfecto! Redirigiendo para configurar tu contraseña...');
            // Redirect to password setup
            setTimeout(() => {
              router.push('/auth/set-password');
            }, 1500);
            return;
          }

          // Regular magic link
          setStatus('success');
          setMessage('¡Acceso confirmado! Redirigiendo al portal...');
          setTimeout(() => {
            router.push('/portal');
          }, 1500);
          return;
        }
      }

      // Check if already authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setStatus('success');
        setMessage('Ya estás autenticado. Redirigiendo...');
        setTimeout(() => {
          router.push('/portal');
        }, 1000);
        return;
      }

      // No valid auth data found
      setStatus('error');
      setMessage('No se encontró información de autenticación válida.');
    };

    handleAuth();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          {status === 'loading' && (
            <>
              <div className="w-12 h-12 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-zinc-600">{message}</p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-zinc-900 font-medium">{message}</p>
            </>
          )}
          
          {status === 'error' && (
            <>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-zinc-900 font-medium">{message}</p>
              <button
                onClick={() => router.push('/portal/login')}
                className="mt-4 text-sm text-zinc-600 hover:text-zinc-900 underline"
              >
                Ir al login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-12 h-12 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-zinc-600">Procesando tu acceso...</p>
          </div>
        </div>
      </div>
    }>
      <AuthConfirmContent />
    </Suspense>
  );
}
