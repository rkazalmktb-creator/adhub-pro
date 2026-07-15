-- Add finishing_percentage to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS finishing_percentage NUMERIC DEFAULT 0;
