import { NextRequest, NextResponse } from 'next/server';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// GET /api/portal/objectives/periods - Get active periods for current user
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthResult();
    if (!auth.user || !auth.employee) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabase = getSupabaseServer();
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || new Date().getFullYear().toString();
    const today = new Date().toISOString().split('T')[0];

    // Get all periods for the year
    const { data: periods, error } = await supabase
      .from('objectives_periods')
      .select('*')
      .eq('year', parseInt(year))
      .eq('is_active', true)
      .order('period_type');

    if (error) {
      console.error('Error fetching periods:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Determine which periods are currently open
    const definitionPeriod = periods?.find(p => p.period_type === 'definition');
    const evaluationPeriod = periods?.find(p => p.period_type === 'evaluation');

    const isDefinitionOpen = definitionPeriod 
      ? today >= definitionPeriod.start_date && today <= definitionPeriod.end_date
      : false;

    const isEvaluationOpen = evaluationPeriod
      ? today >= evaluationPeriod.start_date && today <= evaluationPeriod.end_date
      : false;

    return NextResponse.json({
      year: parseInt(year),
      definitionPeriod,
      evaluationPeriod,
      isDefinitionOpen,
      isEvaluationOpen,
      canCreateObjectives: isDefinitionOpen,
      canEditObjectives: isDefinitionOpen,
      canEvaluateObjectives: isEvaluationOpen,
    });
  } catch (error: any) {
    console.error('Error in GET /api/portal/objectives/periods:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
