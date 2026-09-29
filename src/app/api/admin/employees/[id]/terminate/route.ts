import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { getSupabaseAuthServer } from '@/lib/supabaseAuthServer';
import { invitarAEncuestaDeSalida, type Invitacion } from '@/lib/offboardingSurveyInvite';
import { hoyISO, esBajaProgramada } from '@/lib/bajasProgramadas';

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

    // Una baja con fecha futura se guarda pero no se aplica: el legajo sigue
    // activo hasta ese día. Si se desvinculara ahora, la persona perdería el
    // portal mientras todavía trabaja —el corte mira el estado, no la fecha— y
    // además se le mandaría la encuesta de salida antes de tiempo. El cron
    // diario la aplica el día que corresponde. Ver `src/lib/bajasProgramadas.ts`.
    const programada = termination_date > hoyISO();

    // Update employee with termination data
    const { data: employee, error: updateError } = await supabase
      .from('employees')
      .update({
        ...(programada ? {} : { status: 'terminated' }),
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
    let invitacion: Invitacion | null = null;

    // Si ya contestó, no se toca nada. El upsert de abajo reemplaza la fila
    // entera —eso hace `onConflict`— así que registrar la baja de alguien que
    // ya había contestado le borraba las respuestas, y encima le mandaba un
    // mail pidiéndole que completara lo que ya completó. No es hipotético: las
    // 25 entrevistas importadas del Form viejo están todas en ese caso.
    const { data: yaContestada } = enable_offboarding && !programada
      ? await supabase.from('offboarding_responses').select('*').eq('employee_id', id).maybeSingle()
      : { data: null };

    if (yaContestada?.status === 'submitted') {
      offboarding = yaContestada;
    } else if (enable_offboarding && !programada) {
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

      // Se avisa acá y una sola vez. Desde que el portal corta el acceso a quien
      // ya no trabaja acá, la encuesta es la única pantalla que le queda: sin
      // este mail se entera sólo si se le ocurre entrar. Si falla, la baja ya
      // está registrada igual y la respuesta lo dice, para que RRHH avise a mano.
      invitacion = await invitarAEncuestaDeSalida({
        first_name: employee.first_name,
        personal_email: employee.personal_email,
        work_email: employee.work_email,
        termination_date: employee.termination_date,
      });
      if (!invitacion.enviada) {
        console.error('[Offboarding] no se pudo invitar a la encuesta:', invitacion);
      }
    }

    return NextResponse.json({
      ok: true,
      employee,
      offboarding,
      invitacion,
      programada,
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/employees/[id]/terminate:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/employees/[id]/terminate - Cancelar una baja programada
//
// Sólo sirve mientras la baja no se aplicó. Una vez que el legajo quedó
// desvinculado esto no lo revive: reincorporar a alguien es otra cosa y se
// hace desde el formulario del empleado, a conciencia.
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    const { data: existente } = await supabase
      .from('employees')
      .select('id, status, termination_date')
      .eq('id', id)
      .single();

    if (!existente) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }
    if (!esBajaProgramada(existente)) {
      return NextResponse.json(
        { error: 'Esta persona no tiene una baja programada para cancelar' },
        { status: 400 }
      );
    }

    const { data: employee, error } = await supabase
      .from('employees')
      .update({
        termination_date: null,
        termination_reason: null,
        termination_notes: null,
        terminated_by_user_id: null,
        offboarding_enabled: false,
      })
      .eq('id', id)
      .select(`
        *,
        legal_entity:legal_entities(id, name),
        department:departments(id, name),
        manager:employees!manager_id(id, first_name, last_name)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, employee });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/employees/[id]/terminate:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
