-- Create benefits table
CREATE TABLE IF NOT EXISTS public.benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create benefit_items table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.benefit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  benefit_id uuid NOT NULL REFERENCES public.benefits(id) ON DELETE CASCADE,
  text text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_benefit_items_benefit_id ON public.benefit_items(benefit_id);
CREATE INDEX IF NOT EXISTS idx_benefit_items_display_order ON public.benefit_items(display_order);

-- Insert default benefits if none exist
DO $$
DECLARE
  default_benefit_id uuid;
BEGIN
  -- Check if benefits already exist
  IF NOT EXISTS (SELECT 1 FROM public.benefits LIMIT 1) THEN
    -- Create default benefit record
    INSERT INTO public.benefits (title) VALUES ('Beneficios de Pow') RETURNING id INTO default_benefit_id;
    
    -- Insert default benefit items
    INSERT INTO public.benefit_items (benefit_id, text, display_order) VALUES
      (default_benefit_id, '3 semanas de vacaciones', 1),
      (default_benefit_id, 'Horarios flexibles', 2),
      (default_benefit_id, 'Trabajo remoto', 3),
      (default_benefit_id, 'Revisión salarial cada 6 meses', 4);
  END IF;
END $$;

