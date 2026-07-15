-- Add default_treasury_id column to projects table
-- This allows projects to have a default treasury that will be inherited by new phases
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS default_treasury_id UUID REFERENCES public.treasuries(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.projects.default_treasury_id IS 'Default treasury for the project. New phases will inherit this value.';
