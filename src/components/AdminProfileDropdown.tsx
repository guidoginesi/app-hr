'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseClient';

type AdminUser = {
  email: string;
  firstName?: string;
  lastName?: string;
};

export function AdminProfileDropdown({
  direction = 'down',
  fullWidth = false,
}: {
  direction?: 'up' | 'down';
  fullWidth?: boolean;
} = {}) {
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
        <div className="h-9 w-9 animate-pulse rounded-full bg-secondary" />
        <div className="hidden md:block">
          <div className="h-4 w-24 animate-pulse rounded bg-secondary" />
          <div className="mt-1 h-3 w-32 animate-pulse rounded bg-secondary" />
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
        className={
          fullWidth
            ? `flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary ${isOpen ? 'bg-secondary' : ''}`
            : 'flex items-center gap-3 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm transition-colors hover:bg-secondary'
        }
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white ring-2 ring-ring">
          {initials}
        </div>
        <span className={`${fullWidth ? 'block min-w-0 flex-1' : 'hidden md:block'} text-left`}>
          <span className="block truncate font-medium text-foreground">{displayName}</span>
          <span className="block truncate text-[11px] text-muted-foreground">Administrador</span>
        </span>
        <svg
          className={`h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className={`absolute z-50 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--border)] bg-white py-2 shadow-lg ${direction === 'up' ? 'bottom-full left-0 mb-2' : 'right-0 top-full mt-2'}`}>
          {/* User info header */}
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="font-semibold text-foreground">{displayName}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>

          {/* Logout */}
          <div className="border-t border-[var(--border)] py-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                handleLogout();
              }}
              disabled={isPending}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-secondary-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
