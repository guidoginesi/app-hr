import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const UpdateStudyStatusSchema = z.object({
  is_studying: z.boolean(),
});

// PUT /api/admin/time-off/employees/[id]/study-status - Update employee study status
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateStudyStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // Update employee's is_studying flag
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .update({ is_studying: parsed.data.is_studying })
      .eq('id', id)
      .select()
      .single();

    if (employeeError) {
      console.error('Error updating employee:', employeeError);
      return NextResponse.json({ error: employeeError.message }, { status: 500 });
    }

    if (!employee) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    // Update study leave balance for current year
    const currentYear = new Date().getFullYear();
    const { data: studyType } = await supabase
      .from('leave_types')
      .select('id')
      .eq('code', 'study')
      .single();

    if (studyType) {
      // Upsert balance - set entitled_days based on study status
      await supabase
        .from('leave_balances')
        .upsert(
          {
            employee_id: id,
            leave_type_id: studyType.id,
            year: currentYear,
            entitled_days: parsed.data.is_studying ? 10 : 0,
          },
          {
            onConflict: 'employee_id,leave_type_id,year',
          }
        );
    }

    return NextResponse.json({
      success: true,
      employee_id: id,
      is_studying: parsed.data.is_studying,
    });
  } catch (error: any) {
    console.error('Error in PUT /api/admin/time-off/employees/[id]/study-status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
