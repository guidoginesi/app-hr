import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { 
  getSeniorityCategory, 
  SENIORITY_WEIGHTS,
  OBJECTIVE_WEIGHT_DISTRIBUTION,
  calculateCompletionPercentage,
  isGateMet,
} from '@/types/corporate-objectives';

// NPS score calculation: binary - 100% if met, 0% if not
function calculateNpsScore(actual: number | null, target: number | null): { score: number | null; met: boolean } {
  if (actual === null || target === null) return { score: null, met: false };
  const met = actual >= target;
  return { score: met ? 100 : 0, met };
}

type RouteContext = { params: Promise<{ employeeId: string }> };

// GET /api/admin/objectives/[employeeId]/bonus - Calculate bonus for an employee (admin view)
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { employeeId } = await context.params;
    const { searchParams } = new URL(req.url);
    const yearParam = searchParams.get('year');
    const supabase = getSupabaseServer();
    const currentYear = yearParam ? parseInt(yearParam) : new Date().getFullYear() - 1;

    // Get employee details
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id, first_name, last_name, seniority_level, hire_date')
      .eq('id', employeeId)
      .single();

    if (employeeError || !employee) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    // Calculate pro-rata factor based on hire date
    // Uses actual days worked for precise calculation
    let proRataFactor = 1;
    let proRataMonths = 12;
    let proRataApplies = false;
    
    if (employee.hire_date) {
      const hireDate = new Date(employee.hire_date);
      const yearStart = new Date(currentYear, 0, 1);
      const yearEnd = new Date(currentYear, 11, 31);
      
      if (hireDate > yearStart && hireDate <= yearEnd) {
        proRataApplies = true;
        // Calculate days worked from hire date to end of year
        const endOfYear = new Date(currentYear, 11, 31);
        const daysInYear = 365 + (currentYear % 4 === 0 && (currentYear % 100 !== 0 || currentYear % 400 === 0) ? 1 : 0);
        const daysWorked = Math.ceil((endOfYear.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        proRataFactor = daysWorked / daysInYear;
        // Calculate equivalent months for display (rounded to 1 decimal)
        proRataMonths = Math.round(proRataFactor * 12 * 10) / 10;
      }
    }

    // Get the seniority level that was in effect at the end of the bonus year
    let effectiveSeniorityLevel = employee.seniority_level;
    const isCurrentYear = currentYear === new Date().getFullYear();
    
    if (!isCurrentYear) {
      const yearEndDate = `${currentYear}-12-31`;
      
      const { data: seniorityAtYearEnd } = await supabase
        .from('seniority_history')
        .select('new_level')
        .eq('employee_id', employeeId)
        .lte('effective_date', yearEndDate)
        .order('effective_date', { ascending: false })
        .limit(1)
        .single();
      
      if (seniorityAtYearEnd) {
        effectiveSeniorityLevel = seniorityAtYearEnd.new_level;
      }
    }

    const seniorityCategory = getSeniorityCategory(effectiveSeniorityLevel);
    const weights = seniorityCategory ? SENIORITY_WEIGHTS[seniorityCategory] : SENIORITY_WEIGHTS[1];
    const detailedWeights = seniorityCategory ? OBJECTIVE_WEIGHT_DISTRIBUTION[seniorityCategory] : OBJECTIVE_WEIGHT_DISTRIBUTION[1];

    // Get corporate objectives for the year
    let corporateObjectives: any[] = [];
    try {
      const { data } = await supabase
        .from('corporate_objectives')
        .select('*')
        .eq('year', currentYear)
        .order('objective_type')
        .order('quarter');
      corporateObjectives = data || [];
    } catch {
      // Table might not exist
    }

    // Get personal objectives for this employee
    const { data: personalObjectives } = await supabase
      .from('objectives')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('year', currentYear)
      .is('parent_objective_id', null);

    // Fetch sub-objectives for objectives that have them
    const objectivesWithSubs = await Promise.all(
      (personalObjectives || []).map(async (obj) => {
        if (obj.periodicity && obj.periodicity !== 'annual') {
          const { data: subObjectives } = await supabase
            .from('objectives')
            .select('*')
            .eq('parent_objective_id', obj.id)
            .order('sub_objective_number', { ascending: true });
          return { ...obj, sub_objectives: subObjectives || [] };
        }
        return { ...obj, sub_objectives: [] };
      })
    );

    // Calculate corporate objectives completion
    const billingObjective = corporateObjectives.find(o => o.objective_type === 'billing');
    const npsObjectives = corporateObjectives.filter(o => o.objective_type === 'nps');

    // Calculate billing completion
    let billingCompletion = 0;
    let billingGateMet = false;
    let billingRawCompletion = 0;
    if (billingObjective) {
      billingGateMet = isGateMet(billingObjective.actual_value, billingObjective.target_value, billingObjective.gate_percentage || 90);
      const completion = calculateCompletionPercentage(
        billingObjective.actual_value, 
        billingObjective.target_value,
        billingObjective.cap_percentage || 150
      );
      billingRawCompletion = completion !== null ? Math.min(completion, 100) : 0;
      billingCompletion = billingGateMet ? billingRawCompletion : 0;
    }

    // Calculate NPS completion
    let npsCompletion = 0;
    const npsQuarterResults: { quarter: string; score: number | null; met: boolean; actual: number | null; target: number | null }[] = [];
    
    if (npsObjectives.length > 0) {
      let totalNpsScore = 0;
      let npsCount = 0;
      
      for (const nps of npsObjectives) {
        const { score, met } = calculateNpsScore(nps.actual_value, nps.target_value);
        npsQuarterResults.push({
          quarter: nps.quarter,
          score,
          met,
          actual: nps.actual_value,
          target: nps.target_value,
        });
        if (score !== null) {
          totalNpsScore += score;
          npsCount++;
        }
      }
      
      npsCompletion = npsCount > 0 ? totalNpsScore / npsCount : 0;
    }

    // Calculate personal objectives completion
    let personalCompletion = 0;
    const personalResults: { title: string; achievement: number | null; subObjectives?: { title: string; achievement: number | null }[] }[] = [];
    
    if (objectivesWithSubs && objectivesWithSubs.length > 0) {
      let totalPersonal = 0;
      let personalCount = 0;
      
      for (const obj of objectivesWithSubs) {
        let achievement: number | null = null;
        let subResults: { title: string; achievement: number | null }[] | undefined;
        
        if (obj.sub_objectives && obj.sub_objectives.length > 0) {
          const subAchievements = obj.sub_objectives
            .map((sub: any) => sub.achievement_percentage)
            .filter((a: number | null) => a !== null) as number[];
          
          subResults = obj.sub_objectives.map((sub: any) => ({
            title: sub.title,
            achievement: sub.achievement_percentage ?? null,
          }));
          
          if (subAchievements.length > 0) {
            achievement = Math.round(subAchievements.reduce((sum, a) => sum + a, 0) / subAchievements.length);
          }
        } else {
          achievement = obj.achievement_percentage ?? null;
        }
        
        personalResults.push({
          title: obj.title,
          achievement,
          subObjectives: subResults,
        });
        
        if (achievement !== null) {
          totalPersonal += Math.min(achievement, 100);
          personalCount++;
        }
      }
      
      personalCompletion = personalCount > 0 ? totalPersonal / personalCount : 0;
    }

    // Calculate weighted bonus
    const CORPORATE_BILLING_WEIGHT = 70;
    const CORPORATE_NPS_WEIGHT = 30;
    const companyScore = (billingCompletion * CORPORATE_BILLING_WEIGHT + npsCompletion * CORPORATE_NPS_WEIGHT) / 100;
    const personalScore = personalCompletion;
    const weightedBonus = (companyScore * weights.company + personalScore * weights.area) / 100;
    const finalBonus = weightedBonus * proRataFactor;

    return NextResponse.json({
      member: {
        id: employee.id,
        name: `${employee.first_name} ${employee.last_name}`,
        seniority_level: employee.seniority_level,
        effective_seniority_level: effectiveSeniorityLevel,
        hire_date: employee.hire_date,
      },
      year: currentYear,
      isCurrentYear,
      weights: {
        company: weights.company,
        area: weights.area,
        billing: CORPORATE_BILLING_WEIGHT,
        nps: CORPORATE_NPS_WEIGHT,
        area1: detailedWeights.area1,
        area2: detailedWeights.area2,
      },
      proRata: {
        applies: proRataApplies,
        factor: proRataFactor,
        months: proRataMonths,
        percentage: proRataFactor * 100,
      },
      corporate: {
        billing: {
          target: billingObjective?.target_value || null,
          actual: billingObjective?.actual_value || null,
          gatePercentage: billingObjective?.gate_percentage || 90,
          gateMet: billingGateMet,
          rawCompletion: billingRawCompletion,
          completion: billingCompletion,
        },
        nps: {
          quarters: npsQuarterResults,
          averageCompletion: npsCompletion,
        },
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
        personalComponent: personalScore * (weights.area / 100),
        totalPercentage: weightedBonus,
        gateMet: billingGateMet,
        finalPercentage: finalBonus,
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/admin/objectives/[employeeId]/bonus:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
