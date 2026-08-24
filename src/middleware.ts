import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  ROLE_CACHE_DURATION,
  getRoleCacheKey,
  firmarCache,
  leerCache,
} from '@/lib/roleCache';
import { administracionPuedeEntrar, INICIO_DE_ADMINISTRACION } from '@/lib/administracionRoutes';

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
        // Set cookie with extended expiration for better session persistence
        response.cookies.set({
          name,
          value,
          ...options,
          // Ensure cookies persist for 7 days
          maxAge: options?.maxAge ?? 60 * 60 * 24 * 7,
        });
      },
      remove(name: string, options) {
        response.cookies.set({
          name,
          value: '',
          ...options,
          maxAge: 0,
        });
      },
    },
  });

  // getUser() validates the token and refreshes if needed
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  // If there's a token error, try to refresh the session
  if (userError && userError.message?.includes('token')) {
    console.log('[Middleware] Token error, attempting refresh...');
    const { data: { session } } = await supabase.auth.refreshSession();
    if (session) {
      console.log('[Middleware] Session refreshed successfully');
      // Continue with the refreshed session - cookies are updated via set() callback
    }
  }
  
  const pathname = request.nextUrl.pathname;

  // Admin routes protection
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    if (!user) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    // Try to get cached roles first
    const cacheKey = getRoleCacheKey(user.id);
    let cachedRoles = await leerCache(request.cookies.get(cacheKey)?.value, user.id);

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

      // Sin secreto no se escribe nada: una cookie sin firmar no se va a poder
      // leer después, así que guardarla sólo ensucia el navegador.
      const firmada = await firmarCache(cachedRoles, user.id);
      if (firmada) {
        response.cookies.set({
          name: cacheKey,
          value: firmada,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: ROLE_CACHE_DURATION / 1000,
        });
      }
    }

    const isAdmin = cachedRoles.roles.includes('admin');
    const isAdministracion = cachedRoles.roles.includes('administracion');

    if (!isAdmin) {
      if (isAdministracion) {
        // La lista vive en un solo lado y la comparte la nav: si están acá se
        // ven en el menú, y si no, no. Ver src/lib/administracionRoutes.ts.
        if (!administracionPuedeEntrar(pathname)) {
          return NextResponse.redirect(new URL(INICIO_DE_ADMINISTRACION, request.url));
        }
      } else {
        return NextResponse.redirect(new URL('/admin/login', request.url));
      }
    }
  }

  // Portal routes protection (exclude login page)
  if (pathname.startsWith('/portal') && !pathname.startsWith('/portal/login')) {
    if (!user) {
      return NextResponse.redirect(new URL('/portal/login', request.url));
    }

    // Try to get cached roles first
    const cacheKey = getRoleCacheKey(user.id);
    let cachedRoles = await leerCache(request.cookies.get(cacheKey)?.value, user.id);

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

      // Sin secreto no se escribe nada: una cookie sin firmar no se va a poder
      // leer después, así que guardarla sólo ensucia el navegador.
      const firmada = await firmarCache(cachedRoles, user.id);
      if (firmada) {
        response.cookies.set({
          name: cacheKey,
          value: firmada,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: ROLE_CACHE_DURATION / 1000,
        });
      }
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
