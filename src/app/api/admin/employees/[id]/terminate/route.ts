import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { getSupabaseAuthServer } from '@/lib/supabaseAuthServer';

const TerminateEmployeeSchema = z.object({
  termination_date: z.string().min(1, 'La fecha de baja es requerida'),
  termination_reason: z.enum(['resignation', 'dismissal'] as const, {
    message: 'El motivo debe ser "resignation" o "dismissal"',
  }),
  termination_notes: z.string().optional().nullable(),
  enable_offboarding: z.boolean().default(false),
});

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/admin/employees/[id]/terminate - Register employee termination
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin, user } = await requireAdmin();
    if (!isAdmin || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const parsed = TerminateEmployeeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const { termination_date, termination_reason, termination_notes, enable_offboarding } = parsed.data;

    // Check if employee exists and is not already terminated
    const { data: existingEmployee, error: fetchError } = await supabase
      .from('employees')
      .select('id, first_name, last_name, status')
      .eq('id', id)
      .single();

    if (fetchError || !existingEmployee) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    if (existingEmployee.status === 'terminated') {
      return NextResponse.json(
        { error: 'El empleado ya está dado de baja' },
        { status: 400 }
      );
    }

    // Update employee with termination data
    const { data: employee, error: updateError } = await supabase
      .from('employees')
      .update({
        status: 'terminated',
        termination_date,
        termination_reason,
        termination_notes: termination_notes || null,
        terminated_by_user_id: user.id,
        offboarding_enabled: enable_offboarding,
      })
      .eq('id', id)
      .select(`
        *,
        legal_entity:legal_entities(id, name),
        department:departments(id, name),
        manager:employees!manager_id(id, first_name, last_name)
      `)
      .single();

    if (updateError) {
      console.error('Error updating employee:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // If offboarding is enabled, create or update offboarding response record
    let offboarding = null;
    if (enable_offboarding) {
      const { data: offboardingData, error: offboardingError } = await supabase
        .from('offboarding_responses')
        .upsert(
          {
            employee_id: id,
            status: 'pending',
            responses: {},
          },
          { onConflict: 'employee_id' }
        )
        .select()
        .single();

      if (offboardingError) {
        console.error('Error creating offboarding record:', offboardingError);
        // Don't fail the whole operation, just log the error
      } else {
        offboarding = offboardingData;
      }
    }

    return NextResponse.json({
      ok: true,
      employee,
      offboarding,
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/employees/[id]/terminate:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
