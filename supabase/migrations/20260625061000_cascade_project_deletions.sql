-- Migration to enable ON DELETE CASCADE for all project-related tables
-- This ensures deleting a project cleans up all related records (contracts, purchases, expenses, etc.)

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Dynamically find and drop foreign key constraints on 'project_id' for the target tables
    FOR r IN 
        SELECT 
            tc.table_name, 
            tc.constraint_name
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
        WHERE 
            tc.constraint_type = 'FOREIGN KEY' 
            AND tc.table_schema = 'public'
            AND tc.table_name IN ('contracts', 'expenses', 'purchases', 'income', 'transfers', 'equipment_rentals', 'project_custody', 'custody')
            AND kcu.column_name = 'project_id'
    LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.table_name) || ' DROP CONSTRAINT ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

-- Re-create the foreign keys with ON DELETE CASCADE
ALTER TABLE public.contracts 
  ADD CONSTRAINT contracts_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.expenses 
  ADD CONSTRAINT expenses_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.purchases 
  ADD CONSTRAINT purchases_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.income 
  ADD CONSTRAINT income_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.transfers 
  ADD CONSTRAINT transfers_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.equipment_rentals 
  ADD CONSTRAINT equipment_rentals_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.project_custody 
  ADD CONSTRAINT project_custody_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
