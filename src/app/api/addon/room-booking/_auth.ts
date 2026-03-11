import { NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

export interface AddonEmployee {
  id: string;
  first_name: string;
  last_name: string;
  work_email: string;
}

export interface AddonAuthResult {
  employee: AddonEmployee | null;
  error: string | null;
}

export async function authenticateAddon(req: NextRequest): Promise<AddonAuthResult> {
  const addonKey = req.headers.get('x-addon-key');
  const userEmail = req.headers.get('x-user-email');

  const expectedKey = process.env.ADDON_SECRET;
  if (!expectedKey) {
    return { employee: null, error: 'ADDON_SECRET not configured' };
  }
  if (addonKey !== expectedKey) {
    return { employee: null, error: 'Invalid addon key' };
  }
  if (!userEmail) {
    return { employee: null, error: 'Missing x-user-email header' };
  }

  const supabase = getSupabaseServer();
  const { data: employee, error } = await supabase
    .from('employees')
    .select('id, first_name, last_name, work_email')
    .eq('work_email', userEmail)
    .eq('is_active', true)
    .single();

  if (error || !employee) {
    return { employee: null, error: `Employee not found for email: ${userEmail}` };
  }

  return { employee, error: null };
}
