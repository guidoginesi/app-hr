import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const UpdateRecategorizationSchema = z.object({
  hr_status: z.enum(['pending', 'approved', 'rejected']),
  hr_notes: z.string().nullable().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// PUT /api/admin/recategorizations/[id] - Update HR decision on a recategorization
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const parsed = UpdateRecategorizationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ') },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // Update the recategorization
    const { data, error } = await supabase
      .from('evaluation_recategorization')
      .update({
        hr_status: parsed.data.hr_status,
        hr_notes: parsed.data.hr_notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating recategorization:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If approved, update the employee's seniority level
    if (parsed.data.hr_status === 'approved' && data.recommended_level) {
      // Get the evaluation to find the employee
      const { data: evaluation } = await supabase
        .from('evaluations')
        .select('employee_id')
        .eq('id', data.evaluation_id)
        .single();

      if (evaluation) {
        const { error: updateError } = await supabase
          .from('employees')
          .update({ seniority_level: data.recommended_level })
          .eq('id', evaluation.employee_id);

        if (updateError) {
          console.error('Error updating employee seniority:', updateError);
        }
      }
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in PUT /api/admin/recategorizations/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
