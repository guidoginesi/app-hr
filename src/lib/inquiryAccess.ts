import { getSupabaseServer } from './supabaseServer';

export type InquiryAccess = 'owner' | 'hr' | 'leader' | 'none';

/**
 * Única fuente de verdad de quién puede ver una consulta.
 * El líder NUNCA accede por jerarquía: solo si tiene un permiso vigente
 * en inquiry_leader_shares para esa consulta puntual.
 */
export async function resolveInquiryAccess(
  inquiryId: string,
  auth: { user?: { id: string } | null; isAdmin?: boolean },
): Promise<{ access: InquiryAccess; inquiry: any | null }> {
  if (!auth.user) return { access: 'none', inquiry: null };

  const supabase = getSupabaseServer();
  const { data: inquiry } = await supabase
    .from('employee_inquiries')
    .select('id, user_id, employee_id')
    .eq('id', inquiryId)
    .maybeSingle();

  if (!inquiry) return { access: 'none', inquiry: null };
  if (inquiry.user_id === auth.user.id) return { access: 'owner', inquiry };
  if (auth.isAdmin) return { access: 'hr', inquiry };

  const { data: share } = await supabase
    .from('inquiry_leader_shares')
    .select('id')
    .eq('inquiry_id', inquiryId)
    .eq('leader_user_id', auth.user.id)
    .is('revoked_at', null)
    .maybeSingle();

  return { access: share ? 'leader' : 'none', inquiry };
}

export const ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024;
export const ATTACHMENT_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
export const ATTACHMENT_MAX_PER_INQUIRY = 10;
