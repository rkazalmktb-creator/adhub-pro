-- Add print_date_position column to company_settings
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS print_date_position TEXT DEFAULT 'bottom_left';
