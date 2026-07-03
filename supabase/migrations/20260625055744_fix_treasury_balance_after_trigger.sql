-- Fix the trigger trg_update_balance_after to prevent infinite recursion
CREATE OR REPLACE FUNCTION public.update_balance_after()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Prevent infinite recursion loops when updating the same table in an AFTER trigger
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Update balance_after to reflect the actual treasury balance after the transaction is processed
  UPDATE public.treasury_transactions
  SET balance_after = (SELECT balance FROM public.treasuries WHERE id = NEW.treasury_id)
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;
