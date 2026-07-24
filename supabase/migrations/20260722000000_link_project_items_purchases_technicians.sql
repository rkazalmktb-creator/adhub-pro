-- Add project_item_id to purchases
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS project_item_id UUID REFERENCES public.project_items(id) ON DELETE SET NULL;

-- Add project_item_id to expenses
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS project_item_id UUID REFERENCES public.project_items(id) ON DELETE SET NULL;

-- Add rate and earned_amount to technician_progress_records
ALTER TABLE public.technician_progress_records 
ADD COLUMN IF NOT EXISTS rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS earned_amount NUMERIC DEFAULT 0;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_purchases_project_item_id ON public.purchases(project_item_id);
CREATE INDEX IF NOT EXISTS idx_expenses_project_item_id ON public.expenses(project_item_id);
CREATE INDEX IF NOT EXISTS idx_technician_progress_project_item ON public.technician_progress_records(project_item_id);
CREATE INDEX IF NOT EXISTS idx_technician_progress_technician ON public.technician_progress_records(technician_id);
