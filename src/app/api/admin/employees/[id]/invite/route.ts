import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/lib/supabaseServer';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/admin/employees/[id]/invite - Invite employee to portal
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    // Get employee
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .single();

    if (empError || !employee) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    // Check if already has user
    if (employee.user_id) {
      return NextResponse.json({ error: 'El empleado ya tiene acceso al portal' }, { status: 400 });
    }

    // Use email (preferably work email, fallback to personal)
    const email = employee.work_email || employee.personal_email;

    // Create Supabase Admin client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if user with this email already exists in auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
      // User exists, just link them
      userId = existingUser.id;
    } else {
      // Create new user with invitation
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          first_name: employee.first_name,
          last_name: employee.last_name,
        },
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/confirm`,
      });

      if (createError) {
        console.error('Error creating user:', createError);
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }

      userId = newUser.user.id;
    }

    // Update employee with user_id
    const { error: updateError } = await supabase
      .from('employees')
      .update({ user_id: userId })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating employee:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Add employee role
    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert({ user_id: userId, role: 'employee' }, { onConflict: 'user_id,role' });

    if (roleError) {
      console.error('Error adding role:', roleError);
      // Non-fatal, continue
    }

    return NextResponse.json({ 
      success: true, 
      message: existingUser 
        ? 'Empleado vinculado al portal exitosamente' 
        : 'Invitación enviada exitosamente'
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/employees/[id]/invite:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
