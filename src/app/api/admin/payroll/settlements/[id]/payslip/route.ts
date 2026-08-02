import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import {
  parsePayslipSlot,
  payslipHasBothPdfs,
  payslipStoragePath,
  type PayslipSlot,
} from '@/lib/payrollPayslips';
import { notifyPayslipReplaced } from '@/lib/payrollReceiptReminders';

type RouteContext = { params: Promise<{ id: string }> };

function getSlotFields(slot: PayslipSlot) {
  if (slot === 2) {
    return {
      pathKey: 'pdf2_storage_path' as const,
      filenameKey: 'pdf2_filename' as const,
      uploadedAtKey: 'pdf2_uploaded_at' as const,
      uploadedByKey: 'pdf2_uploaded_by' as const,
    };
  }
  return {
    pathKey: 'pdf_storage_path' as const,
    filenameKey: 'pdf_filename' as const,
    uploadedAtKey: 'pdf_uploaded_at' as const,
    uploadedByKey: 'pdf_uploaded_by' as const,
  };
}

async function syncSettlementStatusAfterPayslipChange(
  supabase: ReturnType<typeof getSupabaseServer>,
  settlementId: string
) {
  const { data: payslip } = await supabase
    .from('payroll_payslips')
    .select('pdf_storage_path, pdf2_storage_path')
    .eq('settlement_id', settlementId)
    .single();

  const { data: settlement } = await supabase
    .from('payroll_employee_settlements')
    .select('status')
    .eq('id', settlementId)
    .single();

  if (!settlement || settlement.status === 'SENT') return;

  if (payslipHasBothPdfs(payslip)) {
    if (settlement.status === 'DRAFT') {
      await supabase
        .from('payroll_employee_settlements')
        .update({ status: 'READY_TO_SEND', updated_at: new Date().toISOString() })
        .eq('id', settlementId);
    }
    return;
  }

  if (settlement.status === 'READY_TO_SEND') {
    await supabase
      .from('payroll_employee_settlements')
      .update({ status: 'DRAFT', updated_at: new Date().toISOString() })
      .eq('id', settlementId);
  }
}

// POST /api/admin/payroll/settlements/[id]/payslip?slot=1|2 - Upload PDF for RELACION_DEPENDENCIA
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin, user } = await requireAdmin();
    if (!isAdmin || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const slot = parsePayslipSlot(req.nextUrl.searchParams.get('slot'));
    const slotFields = getSlotFields(slot);
    const supabase = getSupabaseServer();

    const { data: settlement, error: fetchError } = await supabase
      .from('payroll_employee_settlements')
      .select('*, period:payroll_periods(period_key, status)')
      .eq('id', id)
      .single();

    if (fetchError || !settlement) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    }

    const periodRaw = settlement.period as { period_key: string; status: string } | { period_key: string; status: string }[] | null;
    const periodData = Array.isArray(periodRaw) ? periodRaw[0] : periodRaw;
    if (periodData?.status === 'CLOSED') {
      return NextResponse.json({ error: 'El período está cerrado' }, { status: 400 });
    }

    if (settlement.contract_type_snapshot !== 'RELACION_DEPENDENCIA') {
      return NextResponse.json(
        { error: 'Solo se pueden subir recibos para liquidaciones de relación de dependencia' },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const reason = ((formData.get('reason') as string | null) ?? '').trim();

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó un archivo' }, { status: 400 });
    }

    // Reemplazo de un recibo YA PUBLICADO: exige motivo, genera una versión nueva
    // (sin pisar el archivo confirmado) e invalida la constancia previa.
    const isReplacement = settlement.status === 'SENT';
    if (isReplacement && !reason) {
      return NextResponse.json(
        {
          error:
            'Este recibo ya fue publicado. Indicá el motivo del reemplazo: se generará una versión nueva y el colaborador deberá volver a confirmar la recepción.',
          requires_reason: true,
        },
        { status: 400 },
      );
    }

    // La versión se reserva en la DB ANTES de subir: dos reemplazos concurrentes
    // calculando el número en memoria terminarían pisando el mismo archivo.
    let newVersion: number;
    if (isReplacement) {
      const { data: bumped, error: bumpError } = await supabase
        .rpc('bump_payslip_version', { p_settlement_id: id })
        .single();
      if (bumpError || !bumped) {
        console.error('Error reservando la versión del recibo:', bumpError);
        return NextResponse.json({ error: 'No se pudo reservar la versión del recibo' }, { status: 500 });
      }
      newVersion = (bumped as any).version as number;
    } else {
      const { data: currentPayslip } = await supabase
        .from('payroll_payslips')
        .select('version')
        .eq('settlement_id', id)
        .maybeSingle();
      newVersion = currentPayslip?.version ?? 1;
    }

    const periodKey = periodData?.period_key || 'unknown';
    const storagePath = payslipStoragePath(settlement.employee_id, periodKey, slot, newVersion);
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from('payslips')
      .upload(storagePath, fileBuffer, {
        contentType: 'application/pdf',
        // En un reemplazo el path es nuevo: si ya existe, algo va mal y preferimos
        // fallar antes que pisar un archivo que puede ser evidencia.
        upsert: !isReplacement,
      });

    if (uploadError) {
      console.error('Error uploading payslip PDF:', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: payslip, error: updateError } = await supabase
      .from('payroll_payslips')
      .update({
        [slotFields.pathKey]: storagePath,
        [slotFields.filenameKey]: file.name,
        [slotFields.uploadedAtKey]: new Date().toISOString(),
        [slotFields.uploadedByKey]: user.id,
        version: newVersion,
        ...(isReplacement
          ? { replaced_at: new Date().toISOString(), replaced_by: user.id, replaced_reason: reason }
          : {}),
      })
      .eq('settlement_id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating payslip record:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (isReplacement) {
      // La constancia anterior queda archivada (evidencia de qué archivo se había
      // confirmado) y la persona vuelve a estado pendiente.
      const { error: supersedeError } = await supabase
        .from('payroll_receipt_acknowledgements')
        .update({ superseded_at: new Date().toISOString() })
        .eq('settlement_id', id)
        .is('superseded_at', null)
        // Solo las constancias de versiones anteriores: si el colaborador
        // confirmó la nueva en el ínterin, no se la archivamos.
        .lt('document_version', newVersion);
      if (supersedeError) {
        console.error('[Payslip] no se pudo archivar la constancia previa:', supersedeError);
      }

      await notifyPayslipReplaced(supabase, id, newVersion);
    }

    await syncSettlementStatusAfterPayslipChange(supabase, id);

    return NextResponse.json(payslip, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/admin/payroll/settlements/[id]/payslip:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/payroll/settlements/[id]/payslip?slot=1|2 - Remove uploaded PDF
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const slot = parsePayslipSlot(req.nextUrl.searchParams.get('slot'));
    const slotFields = getSlotFields(slot);
    const supabase = getSupabaseServer();

    const { data: settlement } = await supabase
      .from('payroll_employee_settlements')
      .select('status, period:payroll_periods(status)')
      .eq('id', id)
      .single();

    const periodData = (settlement?.period as { status: string } | { status: string }[] | null | undefined);
    const periodStatus = Array.isArray(periodData) ? periodData[0]?.status : periodData?.status;
    if (periodStatus === 'CLOSED') {
      return NextResponse.json({ error: 'El período está cerrado' }, { status: 400 });
    }

    if (settlement?.status === 'SENT') {
      return NextResponse.json(
        { error: 'No se puede eliminar un PDF de una liquidación ya enviada' },
        { status: 400 }
      );
    }

    const { data: payslip, error: fetchError } = await supabase
      .from('payroll_payslips')
      .select('pdf_storage_path, pdf2_storage_path')
      .eq('settlement_id', id)
      .single();

    if (fetchError || !payslip) {
      return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 });
    }

    const storagePath = payslip[slotFields.pathKey];
    if (storagePath) {
      const { error: storageError } = await supabase.storage
        .from('payslips')
        .remove([storagePath]);

      if (storageError) {
        console.error('Error deleting payslip from storage:', storageError);
      }
    }

    const { error: updateError } = await supabase
      .from('payroll_payslips')
      .update({
        [slotFields.pathKey]: null,
        [slotFields.filenameKey]: null,
        [slotFields.uploadedAtKey]: null,
        [slotFields.uploadedByKey]: null,
      })
      .eq('settlement_id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await syncSettlementStatusAfterPayslipChange(supabase, id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/payroll/settlements/[id]/payslip:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/admin/payroll/settlements/[id]/payslip?slot=1|2 - Download PDF
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const slot = parsePayslipSlot(req.nextUrl.searchParams.get('slot'));
    const slotFields = getSlotFields(slot);
    const supabase = getSupabaseServer();

    const { data: payslip, error: fetchError } = await supabase
      .from('payroll_payslips')
      .select('pdf_storage_path, pdf_filename, pdf2_storage_path, pdf2_filename')
      .eq('settlement_id', id)
      .single();

    if (fetchError || !payslip) {
      return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 });
    }

    const storagePath = payslip[slotFields.pathKey];
    const filename = payslip[slotFields.filenameKey] || `recibo-${slot}.pdf`;

    if (!storagePath) {
      return NextResponse.json({ error: 'No hay PDF cargado para esta liquidación' }, { status: 404 });
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('payslips')
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error('Error downloading payslip for admin:', downloadError);
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('payslips')
        .createSignedUrl(storagePath, 3600);
      if (urlError || !signedUrlData?.signedUrl) {
        return NextResponse.json({ error: urlError?.message || 'Error al obtener el PDF' }, { status: 500 });
      }
      return NextResponse.json({ url: signedUrlData.signedUrl });
    }

    return new NextResponse(fileData, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/admin/payroll/settlements/[id]/payslip:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
