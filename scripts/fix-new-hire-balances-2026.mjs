#!/usr/bin/env node
/**
 * Reset 2026 leave balances for employees hired in 2026 (before Oct 1 accrual).
 *
 * Usage:
 *   node --env-file=.env.local scripts/fix-new-hire-balances-2026.mjs
 *   node --env-file=.env.local scripts/fix-new-hire-balances-2026.mjs --names "Touceda,Baron,Arias"
 */
import { createClient } from '@supabase/supabase-js';

const YEAR = 2026;
const ACCRUAL_TYPES = ['vacation', 'pow_days', 'remote_work'];

function isAnnualLeavePeriodOpen(year) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const periodStart = new Date(year, 9, 1);
  periodStart.setHours(0, 0, 0, 0);
  return today >= periodStart;
}

function entitledForNewHire(code, year) {
  if (!isAnnualLeavePeriodOpen(year)) {
    return ACCRUAL_TYPES.includes(code) ? 0 : null;
  }
  return null;
}

function parseArgs(argv) {
  const namesArg = argv.find((a, i) => argv[i - 1] === '--names');
  return {
    names: namesArg ? namesArg.split(',').map((n) => n.trim().toLowerCase()) : null,
  };
}

async function main() {
  const { names } = parseArgs(process.argv);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('Missing Supabase env vars');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);

  const { data: leaveTypes, error: ltError } = await supabase
    .from('leave_types')
    .select('id, code')
    .in('code', ACCRUAL_TYPES);

  if (ltError || !leaveTypes?.length) {
    console.error('Error fetching leave types:', ltError?.message);
    process.exit(1);
  }

  let employeesQuery = supabase
    .from('employees')
    .select('id, first_name, last_name, hire_date, is_studying, status')
    .gte('hire_date', `${YEAR}-01-01`)
    .eq('status', 'active');

  const { data: employees, error: empError } = await employeesQuery;
  if (empError || !employees) {
    console.error('Error fetching employees:', empError?.message);
    process.exit(1);
  }

  const filtered = names
    ? employees.filter((e) =>
        names.some(
          (n) =>
            e.last_name.toLowerCase().includes(n) || e.first_name.toLowerCase().includes(n)
        )
      )
    : employees;

  if (filtered.length === 0) {
    console.error('No matching employees found');
    process.exit(1);
  }

  console.log(`Fixing ${filtered.length} employee(s) for year ${YEAR}...\n`);

  for (const emp of filtered) {
    console.log(`${emp.first_name} ${emp.last_name} (hire: ${emp.hire_date})`);

    for (const lt of leaveTypes) {
      const resetValue = entitledForNewHire(lt.code, YEAR);
      if (resetValue === null) continue;
      const entitled = resetValue;

      const { data: existing } = await supabase
        .from('leave_balances')
        .select('id, entitled_days')
        .eq('employee_id', emp.id)
        .eq('leave_type_id', lt.id)
        .eq('year', YEAR)
        .maybeSingle();

      if (existing) {
        if (Number(existing.entitled_days) === entitled) {
          console.log(`  ${lt.code}: already ${entitled}`);
          continue;
        }
        await supabase
          .from('leave_balances')
          .update({ entitled_days: entitled, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        console.log(`  ${lt.code}: ${existing.entitled_days} → ${entitled}`);
      } else {
        await supabase.from('leave_balances').insert({
          employee_id: emp.id,
          leave_type_id: lt.id,
          year: YEAR,
          entitled_days: entitled,
          used_days: 0,
          pending_days: 0,
          carried_over: 0,
        });
        console.log(`  ${lt.code}: created with ${entitled}`);
      }
    }
    console.log('');
  }

  console.log('✓ Done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
