import { NextRequest, NextResponse, after } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { requireAdminConLegajo } from '@/lib/adminTimeOffAcciones';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { isUnlimitedLeaveType } from '@/lib/leaveTypes';
import { sincronizarLicencia } from '@/lib/leaveCalendar';
import { borrarEvento } from '@/lib/googleCalendar';

const UpdateRequestSchema = z.object({
  status: z.enum(['pending', 'pending_leader', 'pending_hr', 'approved', 'rejected', 'rejected_leader', 'rejected_hr', 'cancelled']).optional(),
  rejection_reason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// GET /api/admin/time-off/requests/[id] - Get a specific request
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from('leave_requests_with_details')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching leave request:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in GET /api/admin/time-off/requests/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/admin/time-off/requests/[id] - Update a request (approve/reject/etc)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('PUT /api/admin/time-off/requests/[id] - Starting...');

    const { id } = await params;
    const supabase = getSupabaseServer();

    // El chequeo de admin (que ya trae el legajo de quien aprueba, para
    // approved_by) y la solicitud actual no dependen uno del otro: van en
    // paralelo. La solicitud trae el código del tipo de licencia en la misma ida.
    // No se usa nada de ella antes de confirmar que es admin, y los errores
    // salen en el mismo orden que antes: 401, 400 y 404.
    const [{ isAdmin, user, adminEmployee }, { data: currentRequest, error: fetchError }] =
      await Promise.all([
        requireAdminConLegajo(),
        supabase
          .from('leave_requests')
          .select('*, leave_type:leave_types(code)')
          .eq('id', id)
          .single(),
      ]);
    console.log('Auth check:', { isAdmin, userId: user?.id });

    if (!isAdmin || !user) {
      console.log('Unauthorized - not admin or no user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Request ID:', id);
    const body = await req.json();
    const parsed = UpdateRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    console.log('Fetch result:', { currentRequest, fetchError });

    if (fetchError || !currentRequest) {
      console.log('Request not found or error:', fetchError);
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { 
      ...parsed.data,
      updated_at: new Date().toISOString(),
    };

    // Qué hacer con el saldo. Se decide con la solicitud como estaba antes del
    // cambio, pero se escribe recién después de actualizarla: si el update de
    // la solicitud falla, el saldo no se mueve.
    let balanceMove: 'approve' | 'release' | null = null;
    const startYear = new Date(currentRequest.start_date).getFullYear();

    // Handle status changes
    if (parsed.data.status) {
      const oldStatus = currentRequest.status;
      const newStatus = parsed.data.status;
      const isPendingStatus = ['pending', 'pending_leader', 'pending_hr'].includes(oldStatus);
      const isRejectedStatus = ['rejected', 'rejected_leader', 'rejected_hr'].includes(newStatus);

      // HR approving - set HR fields
      if (newStatus === 'approved') {
        updateData.hr_approved_by = adminEmployee?.id || null;
        updateData.hr_approved_at = new Date().toISOString();
        updateData.approved_by = adminEmployee?.id || null;
        updateData.approved_at = new Date().toISOString();
        
        // If skipping leader approval, also set leader fields
        if (oldStatus === 'pending_leader' || oldStatus === 'pending') {
          updateData.leader_id = adminEmployee?.id || null;
          updateData.leader_approved_at = new Date().toISOString();
        }
      }

      // HR rejecting - set HR rejection fields
      if (isRejectedStatus) {
        updateData.status = 'rejected_hr';
        updateData.hr_approved_by = adminEmployee?.id || null;
        updateData.hr_rejection_reason = parsed.data.rejection_reason || null;
      }

      // Update balance based on status change (skip for unlimited types)
      const leaveTypeForBalance = currentRequest.leave_type;
      const tracksBalance = leaveTypeForBalance && !isUnlimitedLeaveType(leaveTypeForBalance.code);

      if (tracksBalance && isPendingStatus && newStatus === 'approved') {
        // Move from pending to used
        balanceMove = 'approve';
      } else if (tracksBalance && isPendingStatus && (isRejectedStatus || newStatus === 'cancelled')) {
        // Remove from pending
        balanceMove = 'release';
      }
    }

    console.log('Updating leave request:', id, 'with data:', updateData);

    // El saldo se LEE en paralelo con el update de la solicitud.
    const [{ data, error }, { data: balance, error: balanceFetchError }] = await Promise.all([
      supabase
        .from('leave_requests')
        .update(updateData)
        .eq('id', id)
        .select()
        .single(),
      balanceMove
        ? supabase
            .from('leave_balances')
            .select('pending_days, used_days')
            .eq('employee_id', currentRequest.employee_id)
            .eq('leave_type_id', currentRequest.leave_type_id)
            .eq('year', startYear)
            .single()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (error) {
      console.error('Error updating leave request:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('Leave request updated successfully:', data);

    if (balanceMove === 'approve') {
      console.log('Balance fetch result:', { balance, error: balanceFetchError, startYear });
    }

    // Con la solicitud ya actualizada se mueve el saldo y, en paralelo, se
    // relee la fila de la vista (nombres de quien aprobó, tipo de licencia),
    // para que la pantalla actualice la fila en el lugar sin recargar la lista.
    const [balanceResult, { data: detalle }] = await Promise.all([
      balanceMove && balance
        ? supabase
            .from('leave_balances')
            .update(
              balanceMove === 'approve'
                ? {
                    pending_days: Math.max(0, balance.pending_days - currentRequest.days_requested),
                    used_days: balance.used_days + currentRequest.days_requested,
                  }
                : {
                    pending_days: Math.max(0, balance.pending_days - currentRequest.days_requested),
                  }
            )
            .eq('employee_id', currentRequest.employee_id)
            .eq('leave_type_id', currentRequest.leave_type_id)
            .eq('year', startYear)
        : Promise.resolve(null),
      supabase.from('leave_requests_with_details').select('*').eq('id', id).maybeSingle(),
    ]);

    if (balanceMove === 'approve' && !balance) {
      console.log('No balance found for this request - skipping balance update');
    }
    if (balanceResult?.error) {
      console.error(
        balanceMove === 'approve' ? 'Error updating balance on approve:' : 'Error updating balance on reject:',
        balanceResult.error
      );
    }

    // Si cambiaron fechas o estado, el evento del calendario tiene que seguirlas.
    // Corre después de responder (after), así no se corta en Vercel.
    after(() =>
      sincronizarLicencia(id).catch((err) => console.error('[calendar] al editar:', err))
    );

    // Se suman los campos de la vista a la fila de leave_requests de siempre:
    // nada de lo que ya devolvía cambia de nombre ni desaparece.
    return NextResponse.json(detalle ? { ...data, ...detalle } : data);
  } catch (error: any) {
    console.error('Error in PUT /api/admin/time-off/requests/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/time-off/requests/[id] - Delete a request
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseServer();

    // Get the request first to update balances
    const { data: request } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (!request) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    // Acá no sirve el reconciliador: se borra la fila, y después no queda de
    // dónde leer el id del evento. Hay que sacarlo antes o queda huérfano.
    if (request.google_event_id) {
      await borrarEvento(request.google_event_id).catch((err) =>
        console.error('[calendar] al eliminar la solicitud:', err),
      );
    }

    // If pending (any pending status), restore the balance
    if (['pending', 'pending_leader', 'pending_hr'].includes(request.status)) {
      const { data: leaveTypeForBalance } = await supabase
        .from('leave_types')
        .select('code')
        .eq('id', request.leave_type_id)
        .single();

      if (leaveTypeForBalance && !isUnlimitedLeaveType(leaveTypeForBalance.code)) {
        const startYear = new Date(request.start_date).getFullYear();
        const { data: balance } = await supabase
          .from('leave_balances')
          .select('pending_days')
          .eq('employee_id', request.employee_id)
          .eq('leave_type_id', request.leave_type_id)
          .eq('year', startYear)
          .single();

        if (balance) {
          await supabase
            .from('leave_balances')
            .update({
              pending_days: Math.max(0, balance.pending_days - request.days_requested),
            })
            .eq('employee_id', request.employee_id)
            .eq('leave_type_id', request.leave_type_id)
            .eq('year', startYear);
        }
      }
    }

    const { error } = await supabase
      .from('leave_requests')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting leave request:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Las notificaciones de esta licencia (al colaborador, al líder y a HR) no
    // tienen FK contra leave_requests: quedaban en la campanita apuntando a una
    // licencia que ya no existe. Si alguien las abría, caía en un Time Off donde
    // no había nada. Se borran por el entity_id que guarda cada aviso; los
    // destinatarios se van solos por la cascada de message_recipients.
    const { error: avisosError } = await supabase
      .from('messages')
      .delete()
      .eq('metadata->>entity_type', 'leave_request')
      .eq('metadata->>entity_id', id);
    if (avisosError) {
      console.error(
        `[TimeOff] licencia ${id} borrada pero sus notificaciones quedaron: ${avisosError.message}`,
      );
    }

    // El certificado vive en Storage, que no tiene FK ni cascada: si no se borra
    // acá, el archivo queda huérfano para siempre y sin fila que lo referencie.
    // Va DESPUÉS del delete y sin frenar la respuesta: la fila ya no existe, y
    // un archivo que sobra es menos grave que un 500 sobre un borrado aplicado.
    if (request.certificate_path) {
      const { error: storageError } = await supabase.storage
        .from('certificates')
        .remove([request.certificate_path as string]);
      if (storageError) {
        console.error(
          `[TimeOff] licencia ${id} borrada pero su certificado quedó en Storage (${request.certificate_path}): ${storageError.message}`,
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/time-off/requests/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
