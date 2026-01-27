'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseClient';

/**
 * SessionProvider component that maintains the auth session active.
 * It listens for auth state changes and refreshes the session periodically.
 * Should be placed in the root layout.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseBrowser();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          // User signed out, redirect to appropriate login
          const pathname = window.location.pathname;
          if (pathname.startsWith('/admin')) {
            router.push('/admin/login');
          } else if (pathname.startsWith('/portal')) {
            router.push('/portal/login');
          }
        } else if (event === 'TOKEN_REFRESHED') {
          // Token was refreshed, refresh the page to update server-side cookies
          router.refresh();
        }
      }
    );

    // Periodically check and refresh the session (every 4 minutes)
    // Supabase access tokens expire after 1 hour by default
    const refreshInterval = setInterval(async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (session) {
        // Check if token will expire in the next 5 minutes
        const expiresAt = session.expires_at;
        if (expiresAt) {
          const expiresIn = expiresAt * 1000 - Date.now();
          const fiveMinutes = 5 * 60 * 1000;
          
          if (expiresIn < fiveMinutes) {
            // Refresh the session
            const { error: refreshError } = await supabase.auth.refreshSession();
            if (!refreshError) {
              // Refresh the page to sync server-side state
              router.refresh();
            }
          }
        }
      }
    }, 4 * 60 * 1000); // Check every 4 minutes

    // Initial session check
    const checkInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Trigger a refresh to ensure cookies are in sync
        router.refresh();
      }
    };
    
    checkInitialSession();

    return () => {
      subscription.unsubscribe();
      clearInterval(refreshInterval);
    };
  }, [router]);

  return <>{children}</>;
}
