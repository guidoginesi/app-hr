import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Cache duration for role checks (5 minutes)
const ROLE_CACHE_DURATION = 5 * 60 * 1000;

type CachedRoles = {
  roles: string[];
  employeeId: string | null;
  hasDirectReports: boolean;
  timestamp: number;
};

function getRoleCacheKey(userId: string): string {
  return `hr_roles_${userId}`;
}

function parseCachedRoles(cookie: string | undefined): CachedRoles | null {
  if (!cookie) return null;
  try {
    const parsed = JSON.parse(cookie) as CachedRoles;
    // Check if cache is still valid
    if (Date.now() - parsed.timestamp < ROLE_CACHE_DURATION) {
      return parsed;
    }
  } catch {
    // Invalid cache, ignore
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options) {
        response.cookies.set({
          name,
          value,
          ...options,
        });
      },
      remove(name: string, options) {
        response.cookies.set({
          name,
          value: '',
          ...options,
        });
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  // Admin routes protection
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    if (!user) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    // Try to get cached roles first
    const cacheKey = getRoleCacheKey(user.id);
    let cachedRoles = parseCachedRoles(request.cookies.get(cacheKey)?.value);

    if (!cachedRoles) {
      // Fetch roles and legacy admin status in parallel
      const [rolesResult, legacyAdminResult] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', user.id),
        supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle(),
      ]);

      const roles = rolesResult.data?.map((r) => r.role) || [];
      if (legacyAdminResult.data) {
        roles.push('admin');
      }

      // Cache the roles
      cachedRoles = {
        roles,
        employeeId: null,
        hasDirectReports: false,
        timestamp: Date.now(),
      };

      response.cookies.set({
        name: cacheKey,
        value: JSON.stringify(cachedRoles),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: ROLE_CACHE_DURATION / 1000,
      });
    }

    const isAdmin = cachedRoles.roles.includes('admin');

    if (!isAdmin) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  // Portal routes protection (exclude login page)
  if (pathname.startsWith('/portal') && !pathname.startsWith('/portal/login')) {
    if (!user) {
      return NextResponse.redirect(new URL('/portal/login', request.url));
    }

    // Try to get cached roles first
    const cacheKey = getRoleCacheKey(user.id);
    let cachedRoles = parseCachedRoles(request.cookies.get(cacheKey)?.value);

    if (!cachedRoles) {
      // Fetch roles and employee data in parallel
      const [rolesResult, employeeResult] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', user.id),
        supabase.from('employees').select('id').eq('user_id', user.id).maybeSingle(),
      ]);

      const roles = rolesResult.data?.map((r) => r.role) || [];
      const employeeId = employeeResult.data?.id || null;

      // Check for direct reports only if we have an employee
      let hasDirectReports = false;
      if (employeeId) {
        const { data: reports } = await supabase
          .from('employees')
          .select('id')
          .eq('manager_id', employeeId)
          .limit(1);
        hasDirectReports = (reports?.length || 0) > 0;
      }

      // Cache the roles
      cachedRoles = {
        roles,
        employeeId,
        hasDirectReports,
        timestamp: Date.now(),
      };

      response.cookies.set({
        name: cacheKey,
        value: JSON.stringify(cachedRoles),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: ROLE_CACHE_DURATION / 1000,
      });
    }

    const hasAccess = 
      cachedRoles.roles.some((r) => ['employee', 'leader'].includes(r)) || 
      !!cachedRoles.employeeId;

    if (!hasAccess) {
      return NextResponse.redirect(new URL('/portal/login', request.url));
    }

    // Team routes require leader role or direct reports
    if (pathname.startsWith('/portal/team')) {
      const isLeader = cachedRoles.roles.includes('leader');
      
      if (!isLeader && !cachedRoles.hasDirectReports) {
        return NextResponse.redirect(new URL('/portal', request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/portal/:path*',
  ],
};
