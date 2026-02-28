import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getSeniorityCategory,
  getSeniorityLabel,
  SENIORITY_WEIGHTS,
  OBJECTIVE_WEIGHT_DISTRIBUTION,
  calculateCompletionPercentage,
  isGateMet,
} from '@/types/corporate-objectives';

const CORPORATE_BILLING_WEIGHT = 70;
const CORPORATE_NPS_WEIGHT = 30;

function calcNpsScore(actual: number | null, target: number | null): { score: number; met: boolean } {
  if (actual === null || target === null) return { score: 0, met: false };
  const met = actual >= target;
  return { score: met ? 100 : 0, met };
}

export type BonusResult = {
  member: {
    id: string;
    name: string;
    department: string;
    seniority_level: string | null;
    effective_seniority_level: string | null;
    seniority_label: string;
    hire_date: string | null;
  };
  year: number;
  isCurrentYear: boolean;
  weights: { company: number; area: number; billing: number; nps: number; area1: number; area2: number };
  proRata: { applies: boolean; factor: number; months: number; percentage: number };
  corporate: {
    billing: {
      target: number | null;
      actual: number | null;
      gatePercentage: number;
      gateMet: boolean;
      rawCompletion: number;
      completion: number;
    };
    nps: {
      quarters: { quarter: string; score: number; met: boolean; actual: number | null; target: number | null }[];
      averageCompletion: number;
    };
    totalCompletion: number;
  };
  personal: {
    objectives: { title: string; achievement: number | null; subObjectives?: { title: string; achievement: number | null }[] }[];
    averageCompletion: number;
    evaluatedCount: number;
    totalCount: number;
  };
  bonus: {
    companyComponent: number;
    personalComponent: number;
    base: number;
    gateMet: boolean;
    final: number;
  };
};

export async function calculateEmployeeBonus(
  supabase: SupabaseClient,
  employeeId: string,
  year: number,
  // Optionally pass pre-fetched corporate objectives to avoid repeated DB calls
  prefetchedCorporateObjectives?: any[],
): Promise<BonusResult | null> {
  // Fetch employee
  const { data: employee, error: empError } = await supabase
    .from('employees')
    .select('id, first_name, last_name, seniority_level, hire_date, department:departments(id, name)')
    .eq('id', employeeId)
    .single();

  if (empError || !employee) return null;

  const department = Array.isArray(employee.department) ? employee.department[0] : employee.department;

  // Pro-rata (months-based)
  const isCurrentYear = year === new Date().getFullYear();
  let proRataFactor = 1;
  let proRataApplies = false;
  let proRataMonths = 12;
  if (employee.hire_date) {
    const hireDate = new Date(employee.hire_date);
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);
    if (hireDate > yearStart && hireDate <= yearEnd) {
      proRataApplies = true;
      proRataMonths = 12 - hireDate.getMonth();
      proRataFactor = proRataMonths / 12;
    }
  }

  // Effective seniority at year-end
  let effectiveSeniorityLevel = employee.seniority_level;
  if (!isCurrentYear) {
    const { data: seniorityAtYearEnd } = await supabase
      .from('seniority_history')
      .select('new_level')
      .eq('employee_id', employeeId)
      .lte('effective_date', `${year}-12-31`)
      .order('effective_date', { ascending: false })
      .limit(1)
      .single();
    if (seniorityAtYearEnd) effectiveSeniorityLevel = seniorityAtYearEnd.new_level;
  }

  const seniorityCategory = getSeniorityCategory(effectiveSeniorityLevel);
  const weights = SENIORITY_WEIGHTS[seniorityCategory ?? 1];
  const detailedWeights = OBJECTIVE_WEIGHT_DISTRIBUTION[seniorityCategory ?? 1];

  // Corporate objectives (use pre-fetched or fetch)
  let corporateObjectives: any[] = prefetchedCorporateObjectives ?? [];
  if (!prefetchedCorporateObjectives) {
    const { data } = await supabase
      .from('corporate_objectives')
      .select('*')
      .eq('year', year)
      .order('objective_type')
      .order('quarter');
    corporateObjectives = data || [];
  }

  const billingObjective = corporateObjectives.find((o: any) => o.objective_type === 'billing');
  const npsObjectives = corporateObjectives.filter((o: any) => o.objective_type === 'nps');

  // Billing
  let billingCompletion = 0;
  let billingGateMet = false;
  let billingRawCompletion = 0;
  if (billingObjective) {
    billingGateMet = isGateMet(billingObjective.actual_value, billingObjective.target_value, billingObjective.gate_percentage || 90);
    const completion = calculateCompletionPercentage(billingObjective.actual_value, billingObjective.target_value, billingObjective.cap_percentage || 150);
    billingRawCompletion = completion !== null ? Math.min(completion, 100) : 0;
    billingCompletion = billingGateMet ? billingRawCompletion : 0;
  }

  // NPS
  let npsCompletion = 0;
  const npsQuarterResults: BonusResult['corporate']['nps']['quarters'] = [];
  if (npsObjectives.length > 0) {
    let totalNps = 0, npsCount = 0;
    for (const nps of npsObjectives) {
      const { score, met } = calcNpsScore(nps.actual_value, nps.target_value);
      npsQuarterResults.push({ quarter: nps.quarter, score, met, actual: nps.actual_value, target: nps.target_value });
      totalNps += score;
      npsCount++;
    }
    npsCompletion = npsCount > 0 ? totalNps / npsCount : 0;
  }

  const companyScore = (billingCompletion * CORPORATE_BILLING_WEIGHT + npsCompletion * CORPORATE_NPS_WEIGHT) / 100;

  // Personal objectives
  const { data: personalObjectives } = await supabase
    .from('objectives')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('year', year)
    .is('parent_objective_id', null);

  const objectivesWithSubs = await Promise.all(
    (personalObjectives || []).map(async (obj: any) => {
      if (obj.periodicity && obj.periodicity !== 'annual') {
        const { data: subs } = await supabase
          .from('objectives')
          .select('*')
          .eq('parent_objective_id', obj.id)
          .order('sub_objective_number', { ascending: true });
        return { ...obj, sub_objectives: subs || [] };
      }
      return { ...obj, sub_objectives: [] };
    })
  );

  let personalCompletion = 0;
  const personalResults: BonusResult['personal']['objectives'] = [];
  if (objectivesWithSubs.length > 0) {
    let total = 0, count = 0;
    for (const obj of objectivesWithSubs) {
      let achievement: number | null = null;
      let subResults: { title: string; achievement: number | null }[] | undefined;
      if (obj.sub_objectives.length > 0) {
        subResults = obj.sub_objectives.map((s: any) => ({ title: s.title, achievement: s.achievement_percentage ?? null }));
        const allEvaluated = obj.sub_objectives.every((s: any) => s.achievement_percentage !== null && s.achievement_percentage !== undefined);
        if (allEvaluated) {
          const subAchs = obj.sub_objectives.map((s: any) => s.achievement_percentage) as number[];
          achievement = Math.round(subAchs.reduce((s: number, a: number) => s + a, 0) / subAchs.length);
        }
        // If not all sub-objectives are evaluated, this objective is not counted (achievement stays null)
      } else {
        // Only count if explicitly evaluated (achievement_percentage set)
        achievement = obj.achievement_percentage ?? null;
      }
      personalResults.push({ title: obj.title, achievement, subObjectives: subResults });
      if (achievement !== null) { total += Math.min(achievement, 100); count++; }
    }
    personalCompletion = count > 0 ? total / count : 0;
  }

  const weightedBonus = (companyScore * weights.company + personalCompletion * weights.area) / 100;
  const finalBonus = weightedBonus * proRataFactor;

  return {
    member: {
      id: employee.id,
      name: `${employee.first_name} ${employee.last_name}`,
      department: department?.name || 'Sin área',
      seniority_level: employee.seniority_level,
      effective_seniority_level: effectiveSeniorityLevel,
      seniority_label: getSeniorityLabel(effectiveSeniorityLevel),
      hire_date: employee.hire_date,
    },
    year,
    isCurrentYear,
    weights: {
      company: weights.company,
      area: weights.area,
      billing: CORPORATE_BILLING_WEIGHT,
      nps: CORPORATE_NPS_WEIGHT,
      area1: detailedWeights.area1,
      area2: detailedWeights.area2,
    },
    proRata: { applies: proRataApplies, factor: proRataFactor, months: proRataMonths, percentage: proRataFactor * 100 },
    corporate: {
      billing: {
        target: billingObjective?.target_value ?? null,
        actual: billingObjective?.actual_value ?? null,
        gatePercentage: billingObjective?.gate_percentage || 90,
        gateMet: billingGateMet,
        rawCompletion: billingRawCompletion,
        completion: billingCompletion,
      },
      nps: { quarters: npsQuarterResults, averageCompletion: npsCompletion },
      totalCompletion: companyScore,
    },
    personal: {
      objectives: personalResults,
      averageCompletion: personalCompletion,
      evaluatedCount: personalResults.filter(p => p.achievement !== null).length,
      totalCount: personalResults.length,
    },
    bonus: {
      companyComponent: companyScore * (weights.company / 100),
      personalComponent: personalCompletion * (weights.area / 100),
      base: weightedBonus,
      gateMet: billingGateMet,
      final: finalBonus,
    },
  };
}
