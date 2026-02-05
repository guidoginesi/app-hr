-- Migration: Remove attachment requirement for study leave
-- The study leave no longer requires uploading a certificate

UPDATE public.leave_types 
SET requires_attachment = false 
WHERE code = 'study';
