'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseClient';

type AdminUser = {
  email: string;
  firstName?: string;
  lastName?: string;
};

export function AdminProfileDropdown() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<AdminUser | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch user info on mount
  useEffect(() => {
    const fetchUser = async () => {
      const supabase = getSupabaseBrowser();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (authUser) {
        setUser({
          email: authUser.email || '',
          firstName: authUser.user_metadata?.first_name,
          lastName: authUser.user_metadata?.last_name,
        });
      }
    };

    fetchUser();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    startTransition(() => {
      router.replace('/admin/login');
      router.refresh();
    });
  };

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 animate-pulse rounded-full bg-zinc-200" />
        <div className="hidden md:block">
          <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
          <div className="mt-1 h-3 w-32 animate-pulse rounded bg-zinc-200" />
        </div>
      </div>
    );
  }

  // Get display name
  const displayName = user.firstName && user.lastName 
    ? `${user.firstName} ${user.lastName}`
    : user.email.split('@')[0];

  // Get initials
  const initials = user.firstName && user.lastName
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : user.email.substring(0, 2).toUpperCase();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-zinc-100"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white ring-2 ring-zinc-300">
          {initials}
        </div>
        <div className="hidden text-left md:block">
          <p className="font-medium text-zinc-900">{displayName}</p>
          <p className="text-xs text-zinc-500">Administrador</p>
        </div>
        <svg
          className={`h-4 w-4 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-zinc-200 bg-white py-2 shadow-lg">
          {/* User info header */}
          <div className="border-b border-zinc-100 px-4 py-3">
            <p className="font-semibold text-zinc-900">{displayName}</p>
            <p className="text-sm text-zinc-500">{user.email}</p>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <a
              href="/admin"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
            </a>

            <a
              href="/admin/people"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              People
            </a>

            <a
              href="/admin/recruiting"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Reclutamiento
            </a>

            <a
              href="/admin/evaluations"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Evaluaciones
            </a>
          </div>

          {/* Logout */}
          <div className="border-t border-zinc-100 py-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                handleLogout();
              }}
              disabled={isPending}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
            >
              <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {isPending ? 'Cerrando sesión...' : 'Cerrar sesión'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
