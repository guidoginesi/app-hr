import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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

    // Check if user is admin
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    // Also check legacy admins table for backward compatibility
    const { data: legacyAdmin } = await supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const isAdmin = roles?.some((r) => r.role === 'admin') || !!legacyAdmin;

    if (!isAdmin) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  // Portal routes protection (exclude login page)
  if (pathname.startsWith('/portal') && !pathname.startsWith('/portal/login')) {
    if (!user) {
      return NextResponse.redirect(new URL('/portal/login', request.url));
    }

    // Check if user has employee or leader role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    // Also check if user has an employee record
    const { data: employee } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    const hasAccess = roles?.some((r) => ['employee', 'leader'].includes(r.role)) || !!employee;

    if (!hasAccess) {
      return NextResponse.redirect(new URL('/portal/login', request.url));
    }

    // Team routes require leader role
    if (pathname.startsWith('/portal/team')) {
      const isLeader = roles?.some((r) => r.role === 'leader');
      
      // Also check if user is a manager (has direct reports)
      let hasDirectReports = false;
      if (employee) {
        const { data: reports } = await supabase
          .from('employees')
          .select('id')
          .eq('manager_id', employee.id)
          .limit(1);
        hasDirectReports = (reports?.length || 0) > 0;
      }

      if (!isLeader && !hasDirectReports) {
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
