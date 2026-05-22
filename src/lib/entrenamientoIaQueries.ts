import { getSupabaseServer } from '@/lib/supabaseServer';
import type { AiTrainingCycle, AiTrainingRankingRow, AiTrainingSession } from '@/types/entrenamiento-ia';

export async function getAiTrainingCycles(): Promise<AiTrainingCycle[]> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('ai_training_cycles')
    .select('*')
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false });
  return (data ?? []) as AiTrainingCycle[];
}

export async function resolveCycleId(cycleId?: string | null): Promise<string | null> {
  if (cycleId) return cycleId;
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('ai_training_cycles')
    .select('id')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function getAiTrainingRanking(cycleId: string): Promise<AiTrainingRankingRow[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('ai_training_rankings')
    .select('*')
    .eq('cycle_id', cycleId);

  if (error) {
    console.error('getAiTrainingRanking:', error);
    return [];
  }
  return (data ?? []) as AiTrainingRankingRow[];
}

export async function getAiTrainingSessions(cycleId?: string | null): Promise<AiTrainingSession[]> {
  const supabase = getSupabaseServer();
  let query = supabase
    .from('ai_training_sessions')
    .select('*')
    .order('session_date', { ascending: false });

  if (cycleId) query = query.eq('cycle_id', cycleId);

  const { data } = await query;
  return (data ?? []) as AiTrainingSession[];
}
