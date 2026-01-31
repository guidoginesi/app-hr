import { NextRequest, NextResponse } from 'next/server';
import { requireLeader } from '@/lib/checkAuth';
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
  // Binary: 100% if actual >= target, 0% otherwise
  const met = actual >= target;
  return { score: met ? 100 : 0, met };
}

type RouteContext = { params: Promise<{ memberId: string }> };

// GET /api/portal/team/[memberId]/bonus - Calculate bonus for a team member
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requireLeader();
    if (!auth || !auth.employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { memberId } = await context.params;
    const { searchParams } = new URL(req.url);
    const yearParam = searchParams.get('year');
    const supabase = getSupabaseServer();
    const currentYear = yearParam ? parseInt(yearParam) : new Date().getFullYear() - 1; // Default to previous year

    // Verify this is a direct report
    const { data: member, error: memberError } = await supabase
      .from('employees')
      .select('id, first_name, last_name, seniority_level, manager_id, hire_date')
      .eq('id', memberId)
      .eq('manager_id', auth.employee.id)
      .single();

    if (memberError || !member) {
      return NextResponse.json({ error: 'Empleado no encontrado o no es tu reporte directo' }, { status: 404 });
    }

    // Calculate pro-rata factor based on hire date
    let proRataFactor = 1; // 100% by default
    let proRataMonths = 12;
    let proRataApplies = false;
    
    if (member.hire_date) {
      const hireDate = new Date(member.hire_date);
      const yearStart = new Date(currentYear, 0, 1); // Jan 1 of evaluated year
      const yearEnd = new Date(currentYear, 11, 31); // Dec 31 of evaluated year
      
      // Only apply pro-rata if hired during the evaluated year
      if (hireDate > yearStart && hireDate <= yearEnd) {
        proRataApplies = true;
        // Calculate months worked (from hire date to end of year)
        const monthsWorked = 12 - hireDate.getMonth(); // Simplified: full months from hire month to December
        proRataMonths = monthsWorked;
        proRataFactor = monthsWorked / 12;
      }
    }

    const seniorityCategory = getSeniorityCategory(member.seniority_level);
    const weights = seniorityCategory ? SENIORITY_WEIGHTS[seniorityCategory] : SENIORITY_WEIGHTS[1];
    const detailedWeights = seniorityCategory ? OBJECTIVE_WEIGHT_DISTRIBUTION[seniorityCategory] : OBJECTIVE_WEIGHT_DISTRIBUTION[1];

    // Get corporate objectives for current year
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

    // Get personal objectives for this employee (only main objectives, not sub-objectives)
    const { data: personalObjectives } = await supabase
      .from('objectives')
      .select('*')
      .eq('employee_id', memberId)
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
    // If gate not met, completion is 0%. If gate met, it's the actual completion percentage.
    let billingCompletion = 0;
    let billingGateMet = false;
    let billingRawCompletion = 0; // The raw percentage before gate check
    if (billingObjective) {
      billingGateMet = isGateMet(billingObjective.actual_value, billingObjective.target_value, billingObjective.gate_percentage || 90);
      const completion = calculateCompletionPercentage(
        billingObjective.actual_value, 
        billingObjective.target_value,
        billingObjective.cap_percentage || 150
      );
      billingRawCompletion = completion !== null ? Math.min(completion, 100) : 0;
      // Only count completion if gate is met
      billingCompletion = billingGateMet ? billingRawCompletion : 0;
    }

    // Calculate NPS completion (average of all quarters - binary per quarter)
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
        
        // For objectives with sub-objectives, calculate average from sub-objectives
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
          // For annual objectives, use direct achievement
          achievement = obj.achievement_percentage ?? null;
        }
        
        personalResults.push({
          title: obj.title,
          achievement,
          subObjectives: subResults,
        });
        
        if (achievement !== null) {
          totalPersonal += Math.min(achievement, 100); // Cap at 100%
          personalCount++;
        }
      }
      
      personalCompletion = personalCount > 0 ? totalPersonal / personalCount : 0;
    }

    // Calculate weighted bonus
    // Corporate objectives have FIXED weights: Billing 70%, NPS 30% (rule applies to everyone)
    const CORPORATE_BILLING_WEIGHT = 70;
    const CORPORATE_NPS_WEIGHT = 30;
    const companyScore = (billingCompletion * CORPORATE_BILLING_WEIGHT + npsCompletion * CORPORATE_NPS_WEIGHT) / 100;

    // Personal/Area component
    const personalScore = personalCompletion;

    // Final weighted score
    const weightedBonus = (companyScore * weights.company + personalScore * weights.area) / 100;
    
    // Apply pro-rata factor
    const finalBonus = weightedBonus * proRataFactor;

    return NextResponse.json({
      member: {
        id: member.id,
        name: `${member.first_name} ${member.last_name}`,
        seniority_level: member.seniority_level,
        hire_date: member.hire_date,
      },
      year: currentYear,
      weights: {
        company: weights.company,
        area: weights.area,
        // Corporate objective weights are fixed for everyone
        billing: CORPORATE_BILLING_WEIGHT,
        nps: CORPORATE_NPS_WEIGHT,
        // Personal objective weights vary by seniority
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
          rawCompletion: billingRawCompletion, // Actual % achieved
          completion: billingCompletion, // % that counts for bonus (0 if gate not met)
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
        totalPercentage: weightedBonus, // Before pro-rata
        gateMet: billingGateMet,
        finalPercentage: finalBonus, // After pro-rata
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/portal/team/[memberId]/bonus:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
