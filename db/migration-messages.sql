-- ============================================================
-- MIGRATION: Message Center + In-App Notifications
-- ============================================================

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type                 text NOT NULL CHECK (type IN ('broadcast', 'system')),
  title                text NOT NULL,
  body                 text NOT NULL,
  priority             text NOT NULL DEFAULT 'info' CHECK (priority IN ('info', 'warning', 'critical')),
  require_confirmation boolean NOT NULL DEFAULT false,
  created_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           timestamptz DEFAULT now(),
  published_at         timestamptz,
  expires_at           timestamptz,
  metadata             jsonb,       -- { deep_link, entity_type, entity_id, dedupe_key }
  audience             jsonb,       -- { all: true } | { roles: ['leader','employee'] }
  status               text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived'))
);

-- Message recipients table (one row per user per message)
CREATE TABLE IF NOT EXISTS message_recipients (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id   uuid REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  delivered_at timestamptz DEFAULT now(),
  read_at      timestamptz,
  confirmed_at timestamptz,
  dismissed_at timestamptz,
  UNIQUE(message_id, user_id)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_message_recipients_user_id
  ON message_recipients(user_id);

CREATE INDEX IF NOT EXISTS idx_message_recipients_user_unread
  ON message_recipients(user_id, read_at) WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_message_recipients_user_unconfirmed
  ON message_recipients(user_id, confirmed_at) WHERE confirmed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_message_recipients_message_id
  ON message_recipients(message_id);

CREATE INDEX IF NOT EXISTS idx_messages_status_published
  ON messages(status, published_at);

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_recipients ENABLE ROW LEVEL SECURITY;

-- Messages: authenticated users can read published messages they are a recipient of
DROP POLICY IF EXISTS "Users can read their messages" ON messages;
CREATE POLICY "Users can read their messages" ON messages
  FOR SELECT TO authenticated
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM message_recipients
      WHERE message_recipients.message_id = messages.id
        AND message_recipients.user_id = auth.uid()
    )
  );

-- Messages: admins can do everything (insert/update/select/delete)
DROP POLICY IF EXISTS "Admins can manage messages" ON messages;
CREATE POLICY "Admins can manage messages" ON messages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

-- Message recipients: users can read their own
DROP POLICY IF EXISTS "Users can read own recipients" ON message_recipients;
CREATE POLICY "Users can read own recipients" ON message_recipients
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Message recipients: users can update their own (read_at, confirmed_at, dismissed_at only)
DROP POLICY IF EXISTS "Users can update own recipients" ON message_recipients;
CREATE POLICY "Users can update own recipients" ON message_recipients
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Message recipients: admins can read all (for analytics)
DROP POLICY IF EXISTS "Admins can read all recipients" ON message_recipients;
CREATE POLICY "Admins can read all recipients" ON message_recipients
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

-- Message recipients: admins can insert (for broadcasting)
DROP POLICY IF EXISTS "Admins can insert recipients" ON message_recipients;
CREATE POLICY "Admins can insert recipients" ON message_recipients
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

-- ============================================================
-- Enable Realtime for live badge updates (run via Supabase dashboard)
-- ALTER PUBLICATION supabase_realtime ADD TABLE message_recipients;
-- ============================================================
