import { getSupabaseAuthServer } from '@/lib/supabaseAuthServer';
import { getSupabaseServer } from '@/lib/supabaseServer';
import type { UserRole, AuthResult, Employee } from '@/types/employee';

/**
 * Get all roles for a user
 */
export async function getUserRoles(userId: string): Promise<UserRole[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  if (error || !data) {
    return [];
  }

  return data.map((r) => r.role as UserRole);
}

/**
 * Get employee record for a user
 */
export async function getEmployeeByUserId(userId: string): Promise<Employee | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Employee;
}

/**
 * Check if user is a leader (has direct reports)
 */
export async function checkIsLeader(employeeId: string): Promise<boolean> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('employees')
    .select('id')
    .eq('manager_id', employeeId)
    .limit(1);

  if (error || !data) {
    return false;
  }

  return data.length > 0;
}

/**
 * Get complete auth result with user, roles, and employee info
 */
export async function getAuthResult(): Promise<AuthResult> {
  const supabaseAuth = await getSupabaseAuthServer();
  const { data: { user } } = await supabaseAuth.auth.getUser();

  if (!user) {
    return {
      user: null,
      roles: [],
      isAdmin: false,
      isEmployee: false,
      isLeader: false,
      employee: null,
    };
  }

  const [roles, employee] = await Promise.all([
    getUserRoles(user.id),
    getEmployeeByUserId(user.id),
  ]);

  // Check if user is a leader based on having direct reports
  let isLeader = roles.includes('leader');
  if (employee && !isLeader) {
    isLeader = await checkIsLeader(employee.id);
  }

  return {
    user: { id: user.id, email: user.email },
    roles,
    isAdmin: roles.includes('admin'),
    isEmployee: roles.includes('employee') || !!employee,
    isLeader,
    employee,
  };
}

/**
 * Require specific roles - returns auth result or null if unauthorized
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<AuthResult | null> {
  const auth = await getAuthResult();

  if (!auth.user) {
    return null;
  }

  // Check if user has any of the allowed roles
  const hasRole = allowedRoles.some((role) => {
    if (role === 'admin') return auth.isAdmin;
    if (role === 'employee') return auth.isEmployee;
    if (role === 'leader') return auth.isLeader;
    return false;
  });

  if (!hasRole) {
    return null;
  }

  return auth;
}

/**
 * Require admin role - backward compatible with existing code
 */
export async function requireAdmin(): Promise<{ user: { id: string; email?: string } | null; isAdmin: boolean }> {
  const auth = await getAuthResult();
  return {
    user: auth.user,
    isAdmin: auth.isAdmin,
  };
}

/**
 * Require employee or leader role (for portal access)
 */
export async function requirePortalAccess(): Promise<AuthResult | null> {
  return requireRole(['employee', 'leader']);
}

/**
 * Require leader role (for team management)
 */
export async function requireLeader(): Promise<AuthResult | null> {
  return requireRole(['leader']);
}

/**
 * Add a role to a user
 */
export async function addUserRole(userId: string, role: UserRole): Promise<boolean> {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('user_roles')
    .insert({ user_id: userId, role })
    .single();

  return !error;
}

/**
 * Remove a role from a user
 */
export async function removeUserRole(userId: string, role: UserRole): Promise<boolean> {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', userId)
    .eq('role', role);

  return !error;
}

/**
 * Get direct reports for a manager
 */
export async function getDirectReports(managerId: string): Promise<Employee[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('manager_id', managerId)
    .eq('status', 'active')
    .order('last_name');

  if (error || !data) {
    return [];
  }

  return data as Employee[];
}
