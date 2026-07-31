import { getSupabaseServer } from './supabaseServer';

type NotificationPriority = 'info' | 'warning' | 'critical';

export type SystemNotificationParams = {
  userIds: string[]; // auth.users ids
  title: string;
  body: string;
  priority?: NotificationPriority;
  requireConfirmation?: boolean;
  deepLink?: string;
  metadata?: Record<string, unknown>;
  dedupeKey?: string;
};

export type BroadcastAudience =
  | { all: true }
  | { roles: string[] }
  | { test: true }
  | { employment_type: 'monotributista' | 'dependency' }
  | { department_id: string }
  | { manager_id: string }
  | { user_ids: string[] };

export type BroadcastMessageParams = {
  createdBy: string; // auth.users id
  title: string;
  body: string;
  priority?: NotificationPriority;
  requireConfirmation?: boolean;
  expiresAt?: string;
  audience: BroadcastAudience;
};

const BATCH_SIZE = 500;

/**
 * Create a system notification for one or more users.
 * Used by automated events (time-off status changes, etc.).
 * Supports deduplication via dedupeKey in metadata.
 */
export async function createSystemNotification(
  params: SystemNotificationParams
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (params.userIds.length === 0) return { success: true };

  try {
    const supabase = getSupabaseServer();

    const metadata: Record<string, unknown> = { ...(params.metadata ?? {}) };
    if (params.deepLink) metadata.deep_link = params.deepLink;
    if (params.dedupeKey) metadata.dedupe_key = params.dedupeKey;

    // Dedupe check: if dedupeKey provided, skip users that already have this notification
    let targetUserIds = [...params.userIds];
    if (params.dedupeKey) {
      const { data: existing } = await supabase
        .from('messages')
        .select('id, message_recipients(user_id)')
        .eq('status', 'published')
        .contains('metadata', { dedupe_key: params.dedupeKey });

      if (existing && existing.length > 0) {
        const alreadyNotifiedUserIds = new Set<string>(
          existing.flatMap((m: any) =>
            (m.message_recipients ?? []).map((r: any) => r.user_id as string)
          )
        );
        targetUserIds = targetUserIds.filter((id) => !alreadyNotifiedUserIds.has(id));
      }

      if (targetUserIds.length === 0) {
        return { success: true };
      }
    }

    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        type: 'system',
        title: params.title,
        body: params.body,
        priority: params.priority ?? 'info',
        require_confirmation: params.requireConfirmation ?? false,
        status: 'published',
        published_at: new Date().toISOString(),
        metadata,
      })
      .select('id')
      .single();

    if (messageError || !message) {
      console.error('[NotificationService] Error creating message:', messageError);
      return { success: false, error: messageError?.message ?? 'Error creating message' };
    }

    for (let i = 0; i < targetUserIds.length; i += BATCH_SIZE) {
      const batch = targetUserIds.slice(i, i + BATCH_SIZE);
      const recipients = batch.map((userId) => ({
        message_id: message.id,
        user_id: userId,
      }));

      const { error: recipientsError } = await supabase
        .from('message_recipients')
        .insert(recipients);

      if (recipientsError) {
        console.error('[NotificationService] Error inserting recipients batch:', recipientsError);
      }
    }

    return { success: true, messageId: message.id };
  } catch (error: any) {
    console.error('[NotificationService] createSystemNotification error:', error);
    return { success: false, error: error.message };
  }
}

// Test audience: [first_name fragment, last_name fragment] — both must match (ilike)
const TEST_AUDIENCE_MEMBERS = [
  { first: 'Agustina', last: 'Martinez' },  // Agustina Martinez Marques
  { first: 'Guido',    last: 'Ginesi' },    // Guido Daniel Ginesi
  { first: 'Antonella', last: 'Medone' },   // Antonella Medone
];

/**
 * Resolve user IDs from audience filter.
 * Supports { all: true }, { roles: string[] }, { employment_type }, or { test: true }.
 */
export async function resolveAudienceUserIds(
  audience: BroadcastAudience
): Promise<string[]> {
  const supabase = getSupabaseServer();

  if ('all' in audience && audience.all) {
    const { data } = await supabase
      .from('employees')
      .select('user_id')
      .eq('status', 'active')
      .not('user_id', 'is', null);

    return (data ?? []).map((e: any) => e.user_id as string).filter(Boolean);
  }

  if ('employment_type' in audience) {
    const { data } = await supabase
      .from('employees')
      .select('user_id')
      .eq('status', 'active')
      .eq('employment_type', audience.employment_type)
      .not('user_id', 'is', null);

    return (data ?? []).map((e: any) => e.user_id as string).filter(Boolean);
  }

  if ('roles' in audience && audience.roles.length > 0) {
    const { data } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', audience.roles);

    return (data ?? []).map((r: any) => r.user_id as string).filter(Boolean);
  }

  if ('test' in audience && audience.test) {
    const userIds: string[] = [];
    for (const { first, last } of TEST_AUDIENCE_MEMBERS) {
      const { data } = await supabase
        .from('employees')
        .select('user_id')
        .ilike('first_name', `%${first}%`)
        .ilike('last_name', `%${last}%`)
        .not('user_id', 'is', null)
        .limit(1);

      const uid = data?.[0]?.user_id;
      if (uid) userIds.push(uid);
    }
    return userIds;
  }

  if ('department_id' in audience && audience.department_id) {
    const { data } = await supabase
      .from('employees')
      .select('user_id')
      .eq('status', 'active')
      .eq('department_id', audience.department_id)
      .not('user_id', 'is', null);
    return (data ?? []).map((e: any) => e.user_id as string).filter(Boolean);
  }

  if ('manager_id' in audience && audience.manager_id) {
    const { data } = await supabase
      .from('employees')
      .select('user_id')
      .eq('status', 'active')
      .eq('manager_id', audience.manager_id)
      .not('user_id', 'is', null);
    return (data ?? []).map((e: any) => e.user_id as string).filter(Boolean);
  }

  if ('user_ids' in audience && Array.isArray(audience.user_ids) && audience.user_ids.length > 0) {
    return audience.user_ids.filter(Boolean);
  }

  return [];
}

/**
 * Get all admin user IDs (for HR notifications).
 */
export async function getAdminUserIds(): Promise<string[]> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'admin');

  return (data ?? []).map((r: any) => r.user_id as string);
}

/**
 * Get the distinct user IDs that hold any of the given roles.
 */
export async function getUserIdsForRoles(roles: string[]): Promise<string[]> {
  if (roles.length === 0) return [];
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('user_roles')
    .select('user_id')
    .in('role', roles);

  return [...new Set((data ?? []).map((r: any) => r.user_id as string).filter(Boolean))];
}

/**
 * Resolve email addresses for all users holding the given roles.
 * Prefers the employee work/personal email, and falls back to the auth.users
 * email for role holders that are not employees (e.g. the generic admin /
 * administración accounts). Reusable for any role-targeted email (digests, etc.).
 */
export async function getEmailsForUserIds(
  userIds: string[],
): Promise<{ userId: string; email: string; name: string }[]> {
  if (userIds.length === 0) return [];

  const supabase = getSupabaseServer();
  const { data: emps } = await supabase
    .from('employees')
    .select('user_id, first_name, last_name, work_email, personal_email')
    .in('user_id', userIds);
  const empByUser = new Map<string, any>((emps ?? []).map((e: any) => [e.user_id, e]));

  const out: { userId: string; email: string; name: string }[] = [];
  const missing: string[] = [];
  for (const uid of userIds) {
    const e = empByUser.get(uid);
    const email = e?.work_email || e?.personal_email;
    if (email) {
      out.push({ userId: uid, email, name: `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim() });
    } else {
      missing.push(uid);
    }
  }

  if (missing.length > 0) {
    try {
      const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const authById = new Map<string, any>((list?.users ?? []).map((u: any) => [u.id, u]));
      for (const uid of missing) {
        const u = authById.get(uid);
        if (u?.email) {
          const metaName =
            (u.user_metadata?.full_name as string) || (u.user_metadata?.name as string) || '';
          out.push({ userId: uid, email: u.email as string, name: metaName });
        }
      }
    } catch (err) {
      console.error('[getEmailsForUserIds] auth.users fallback failed:', err);
    }
  }

  return out;
}

export async function getRoleEmails(
  roles: string[],
): Promise<{ userId: string; email: string; name: string }[]> {
  const userIds = await getUserIdsForRoles(roles);
  return getEmailsForUserIds(userIds);
}
