import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { requireLeader } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { PortalShell } from '../../PortalShell';
import { TeamMemberProfileClient } from './TeamMemberProfileClient';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TeamMemberProfilePage({ params }: PageProps) {
  const auth = await requireLeader();
  
  if (!auth || !auth.employee) {
    redirect('/portal');
  }

  const { employee, isLeader } = auth;
  const { id: memberId } = await params;
  const supabase = getSupabaseServer();

  // Verify this person is a direct report
  const { data: member, error: memberError } = await supabase
    .from('employees')
    .select(`
      *,
      department:departments(id, name),
      legal_entity:legal_entities(id, name)
    `)
    .eq('id', memberId)
    .eq('manager_id', employee.id)
    .single();

  if (memberError || !member) {
    notFound();
  }

  // Get evaluations for this employee (both self and leader evaluations)
  const { data: evaluations } = await supabase
    .from('evaluations')
    .select(`
      *,
      period:evaluation_periods(id, name, year, status),
      evaluator:employees!evaluations_evaluator_id_fkey(id, first_name, last_name)
    `)
    .eq('employee_id', memberId)
    .order('created_at', { ascending: false });

  // Get objectives for this employee
  const { data: objectives } = await supabase
    .from('objectives')
    .select('*')
    .eq('employee_id', memberId)
    .order('year', { ascending: false })
    .order('period_type');

  // Get seniority history
  let seniorityHistory: any[] = [];
  try {
    const { data } = await supabase
      .from('seniority_history')
      .select('*')
      .eq('employee_id', memberId)
      .order('effective_date', { ascending: false });
    seniorityHistory = data || [];
  } catch {
    // Table might not exist
  }

  // Get available years from corporate objectives (years that admins have configured)
  let availableBonusYears: number[] = [];
  try {
    const { data } = await supabase
      .from('corporate_objectives')
      .select('year')
      .order('year', { ascending: false });
    
    if (data) {
      // Get unique years
      availableBonusYears = [...new Set(data.map(d => d.year))];
    }
  } catch {
    // Table might not exist
  }

  return (
    <PortalShell employee={employee} isLeader={isLeader} active="team">
      <TeamMemberProfileClient
        member={member}
        evaluations={evaluations || []}
        objectives={objectives || []}
        seniorityHistory={seniorityHistory}
        availableBonusYears={availableBonusYears}
      />
    </PortalShell>
  );
}
