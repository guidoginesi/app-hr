import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { EvaluationsShell } from '../EvaluationsShell';
import { DimensionsClient } from './DimensionsClient';

export const dynamic = 'force-dynamic';

export default async function EvaluationDimensionsPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  const supabase = getSupabaseServer();

  // Get all periods for selection
  const { data: periods } = await supabase
    .from('evaluation_periods')
    .select('*')
    .order('year', { ascending: false });

  // Get active period's dimensions by default
  const activePeriod = periods?.find(p => p.is_active) || periods?.[0];

  let dimensions: any[] = [];
  if (activePeriod) {
    const { data } = await supabase
      .from('evaluation_dimensions')
      .select(`
        *,
        items:evaluation_items(*)
      `)
      .eq('period_id', activePeriod.id)
      .order('order_index', { ascending: true });

    dimensions = data?.map(dim => ({
      ...dim,
      items: dim.items?.sort((a: any, b: any) => a.order_index - b.order_index)
    })) || [];
  }

  return (
    <EvaluationsShell active="dimensions">
      <DimensionsClient
        periods={periods || []}
        initialPeriodId={activePeriod?.id || null}
        initialDimensions={dimensions}
      />
    </EvaluationsShell>
  );
}
