import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { calculateEmployeeBonus } from '@/lib/calculateBonus';
import { ObjectivesShell } from '../ObjectivesShell';
import { BonosClient } from './BonosClient';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ year?: string }>;

export default async function BonosPage({ searchParams }: { searchParams: SearchParams }) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect('/admin/login');

  const { year: yearParam } = await searchParams;
  const supabase = getSupabaseServer();

  // Available years from corporate_objectives
  const { data: yearRows } = await supabase
    .from('corporate_objectives')
    .select('year')
    .order('year', { ascending: false });

  const availableYears = yearRows
    ? [...new Set(yearRows.map((r: any) => r.year as number))]
    : [];

  const prevYear = new Date().getFullYear() - 1;
  const defaultYear = availableYears.includes(prevYear)
    ? prevYear
    : (availableYears[0] ?? prevYear);
  const selectedYear = yearParam ? parseInt(yearParam) : defaultYear;

  // Fetch all active employees
  const { data: employees } = await supabase
    .from('employees')
    .select('id')
    .eq('status', 'active')
    .order('last_name');

  // Pre-fetch corporate objectives once (shared across all employees)
  const { data: corporateObjectives } = await supabase
    .from('corporate_objectives')
    .select('*')
    .eq('year', selectedYear)
    .order('objective_type')
    .order('quarter');

  // Calculate bonus for each employee in parallel using the shared utility
  const bonusResults = await Promise.all(
    (employees || []).map(emp =>
      calculateEmployeeBonus(supabase, emp.id, selectedYear, corporateObjectives || [])
    )
  );

  const bonusRows = bonusResults
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .map(r => ({
      id: r.member.id,
      name: r.member.name,
      department: r.member.department,
      seniority_level: r.member.effective_seniority_level,
      seniority_label: r.member.seniority_label,
      weights: { company: r.weights.company, area: r.weights.area },
      corporate: { completion: r.corporate.totalCompletion, gateMet: r.corporate.billing.gateMet },
      personal: {
        completion: r.personal.averageCompletion,
        evaluatedCount: r.personal.evaluatedCount,
        totalCount: r.personal.totalCount,
        objectives: r.personal.objectives,
      },
      proRata: r.proRata,
      bonus: { base: r.bonus.base, final: r.bonus.final },
    }));

  const billingObj = (corporateObjectives || []).find((o: any) => o.objective_type === 'billing');
  const npsObjs = (corporateObjectives || []).filter((o: any) => o.objective_type === 'nps');
  const firstResult = bonusResults.find(r => r !== null);

  const corporateSummary = {
    billingTarget: billingObj?.target_value ?? null,
    billingActual: billingObj?.actual_value ?? null,
    billingGateMet: firstResult?.corporate.billing.gateMet ?? false,
    billingCompletion: firstResult?.corporate.billing.rawCompletion ?? 0,
    npsCompletion: firstResult?.corporate.nps.averageCompletion ?? 0,
    totalCompletion: firstResult?.corporate.totalCompletion ?? 0,
    npsQuarters: npsObjs.map((n: any) => ({
      quarter: n.quarter,
      actual: n.actual_value,
      target: n.target_value,
      met: (n.actual_value ?? 0) >= (n.target_value ?? 0),
    })),
  };

  return (
    <ObjectivesShell active="bonos">
      <BonosClient
        bonusRows={bonusRows}
        corporateSummary={corporateSummary}
        selectedYear={selectedYear}
        availableYears={availableYears.length > 0 ? availableYears : [selectedYear]}
      />
    </ObjectivesShell>
  );
}
