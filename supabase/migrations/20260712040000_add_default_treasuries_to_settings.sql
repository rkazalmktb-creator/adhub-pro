-- Add default treasuries for contracting and finishing projects to company_settings
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS contracting_treasury_id UUID REFERENCES public.treasuries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS finishing_treasury_id UUID REFERENCES public.treasuries(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.company_settings.contracting_treasury_id IS 'Default treasury for contracting projects';
COMMENT ON COLUMN public.company_settings.finishing_treasury_id IS 'Default treasury for finishing projects';
