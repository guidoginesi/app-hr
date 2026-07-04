#!/usr/bin/env node
/**
 * Upload/replace a payslip PDF for an employee's payroll settlement.
 *
 * Usage:
 *   node --env-file=.env.local scripts/upload-payslip.mjs \
 *     --employee "Panaro" --period 2026-05 --file "/path/to/recibo.pdf" [--slot 1|2]
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { basename } from 'path';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (key.startsWith('--')) {
      args[key.slice(2)] = argv[++i];
    }
  }
  return args;
}

async function main() {
  const { employee, period, file, slot: slotArg } = parseArgs(process.argv);
  const slot = slotArg === '2' ? 2 : 1;

  if (!employee || !period || !file) {
    console.error(
      'Usage: node --env-file=.env.local scripts/upload-payslip.mjs --employee "Panaro" --period 2026-05 --file "/path/to/recibo.pdf" [--slot 1|2]'
    );
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);
  const search = employee.trim().toLowerCase();

  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('id, first_name, last_name, employment_type')
    .or(`last_name.ilike.%${search}%,first_name.ilike.%${search}%`);

  if (empError) {
    console.error('Error buscando empleado:', empError.message);
    process.exit(1);
  }

  const matches = (employees ?? []).filter((e) => {
    const name = `${e.first_name} ${e.last_name}`.toLowerCase();
    return name.includes(search) || e.last_name.toLowerCase().includes(search);
  });

  if (matches.length === 0) {
    console.error(`No se encontró empleado que coincida con "${employee}"`);
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error('Varios empleados coinciden:');
    for (const m of matches) console.error(`  - ${m.first_name} ${m.last_name} (${m.id})`);
    process.exit(1);
  }

  const emp = matches[0];
  console.log(`Empleado: ${emp.first_name} ${emp.last_name} (${emp.id})`);

  const { data: payrollPeriod, error: periodError } = await supabase
    .from('payroll_periods')
    .select('id, period_key, year, month')
    .eq('period_key', period)
    .maybeSingle();

  if (periodError || !payrollPeriod) {
    console.error(`No se encontró período ${period}:`, periodError?.message ?? 'sin datos');
    process.exit(1);
  }

  console.log(`Período: ${payrollPeriod.period_key}`);

  const { data: settlement, error: settError } = await supabase
    .from('payroll_employee_settlements')
    .select('id, contract_type_snapshot, status')
    .eq('period_id', payrollPeriod.id)
    .eq('employee_id', emp.id)
    .maybeSingle();

  if (settError || !settlement) {
    console.error('No se encontró liquidación:', settError?.message ?? 'sin datos');
    process.exit(1);
  }

  if (settlement.contract_type_snapshot !== 'RELACION_DEPENDENCIA') {
    console.error(
      `La liquidación es ${settlement.contract_type_snapshot}, no RELACION_DEPENDENCIA. Subí el recibo solo para relación de dependencia.`
    );
    process.exit(1);
  }

  console.log(`Settlement: ${settlement.id} (${settlement.status})`);

  const storagePath =
    slot === 2
      ? `${emp.id}/${payrollPeriod.period_key}-2.pdf`
      : `${emp.id}/${payrollPeriod.period_key}.pdf`;
  const fileBuffer = readFileSync(file);
  const filename = basename(file);

  const { error: uploadError } = await supabase.storage
    .from('payslips')
    .upload(storagePath, fileBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    console.error('Error subiendo PDF:', uploadError.message);
    process.exit(1);
  }

  console.log(`Storage: payslips/${storagePath}`);

  const { data: existingPayslip } = await supabase
    .from('payroll_payslips')
    .select('settlement_id, pdf_storage_path, pdf2_storage_path')
    .eq('settlement_id', settlement.id)
    .maybeSingle();

  const payslipPayload =
    slot === 2
      ? {
          pdf2_storage_path: storagePath,
          pdf2_filename: filename,
          pdf2_uploaded_at: new Date().toISOString(),
          pdf2_uploaded_by: null,
        }
      : {
          pdf_storage_path: storagePath,
          pdf_filename: filename,
          pdf_uploaded_at: new Date().toISOString(),
          pdf_uploaded_by: null,
        };

  let payslipError;
  if (existingPayslip) {
    ({ error: payslipError } = await supabase
      .from('payroll_payslips')
      .update(payslipPayload)
      .eq('settlement_id', settlement.id));
  } else {
    ({ error: payslipError } = await supabase
      .from('payroll_payslips')
      .insert({ settlement_id: settlement.id, ...payslipPayload }));
  }

  if (payslipError) {
    console.error('Error actualizando payroll_payslips:', payslipError.message);
    process.exit(1);
  }

  const mergedPayslip = {
    pdf_storage_path:
      slot === 1 ? storagePath : existingPayslip?.pdf_storage_path ?? null,
    pdf2_storage_path:
      slot === 2 ? storagePath : existingPayslip?.pdf2_storage_path ?? null,
  };

  if (settlement.status === 'DRAFT' && mergedPayslip.pdf_storage_path && mergedPayslip.pdf2_storage_path) {
    await supabase
      .from('payroll_employee_settlements')
      .update({ status: 'READY_TO_SEND', updated_at: new Date().toISOString() })
      .eq('id', settlement.id);
    console.log('Estado actualizado: DRAFT → READY_TO_SEND');
  } else if (settlement.status === 'READY_TO_SEND' && !(mergedPayslip.pdf_storage_path && mergedPayslip.pdf2_storage_path)) {
    await supabase
      .from('payroll_employee_settlements')
      .update({ status: 'DRAFT', updated_at: new Date().toISOString() })
      .eq('id', settlement.id);
    console.log('Estado actualizado: READY_TO_SEND → DRAFT (falta un PDF)');
  }

  console.log(`✓ Recibo PDF ${slot} reemplazado: ${filename}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
