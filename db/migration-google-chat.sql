-- Migration: Add Google Chat integration
-- Adds send_to_google_chat flag to email_templates (for automations)
-- and to messages (for admin broadcast messages)

ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS send_to_google_chat boolean NOT NULL DEFAULT false;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS send_to_google_chat boolean NOT NULL DEFAULT false;
