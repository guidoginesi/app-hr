-- Migration: Password Reset Tokens
-- Custom password reset flow using Resend

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_password_reset_token ON public.password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_email ON public.password_reset_tokens(email);

-- Cleanup old tokens (can be run periodically)
-- DELETE FROM public.password_reset_tokens WHERE expires_at < now() - interval '7 days';

-- RLS
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table (no direct client access)
CREATE POLICY "Service role only"
  ON public.password_reset_tokens
  FOR ALL
  USING (false);

COMMENT ON TABLE public.password_reset_tokens IS 'Tokens para reseteo de contraseña';
