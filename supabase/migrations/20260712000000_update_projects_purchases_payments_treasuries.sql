-- Migration: Update Projects, Purchases, Payments, and Treasuries Schema and Triggers
-- Date: 2026-07-12

-- 1. Structural alterations
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'contracting' CHECK (project_type IN ('contracting', 'finishing'));
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS purchase_type TEXT NOT NULL DEFAULT 'material' CHECK (purchase_type IN ('material', 'labor', 'rental'));
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.treasuries ADD COLUMN IF NOT EXISTS project_category TEXT CHECK (project_category IN ('contracting', 'finishing'));
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS treasury_id UUID REFERENCES public.treasuries(id) ON DELETE SET NULL;

-- 2. Create purchase_payments table
CREATE TABLE IF NOT EXISTS public.purchase_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0 CHECK (amount > 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  treasury_id UUID NOT NULL REFERENCES public.treasuries(id) ON DELETE RESTRICT,
  commission NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Enablement
ALTER TABLE public.purchase_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Admins can manage purchase_payments" ON public.purchase_payments;
CREATE POLICY "Admins can manage purchase_payments" 
  ON public.purchase_payments FOR ALL 
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can view purchase_payments" ON public.purchase_payments;
CREATE POLICY "Authenticated can view purchase_payments" 
  ON public.purchase_payments FOR SELECT 
  USING (true);

-- 3. Trigger function for purchase_payments sync to treasury and purchases
CREATE OR REPLACE FUNCTION public.handle_purchase_payment_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_paid NUMERIC;
  purchase_total NUMERIC;
  new_status TEXT;
  parent_purchase_treasury_id UUID;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Get parent purchase total
    SELECT total_amount, treasury_id INTO purchase_total, parent_purchase_treasury_id 
    FROM public.purchases WHERE id = NEW.purchase_id;

    -- Delete existing transaction for this payment if updating
    IF TG_OP = 'UPDATE' THEN
      DELETE FROM public.treasury_transactions
      WHERE reference_id = NEW.id AND reference_type = 'purchase_payment';
    END IF;

    -- Insert withdrawal transaction to deduct from selected treasury
    INSERT INTO public.treasury_transactions (
      treasury_id, type, amount, balance_after, description,
      reference_id, reference_type, date, source
    ) VALUES (
      NEW.treasury_id, 'withdrawal',
      NEW.amount + COALESCE(NEW.commission, 0), 0,
      'سداد دفعة فاتورة مشتريات رقم ' || COALESCE(
        (SELECT invoice_number FROM public.purchases WHERE id = NEW.purchase_id), 
        NEW.purchase_id::text
      ),
      NEW.id, 'purchase_payment', NEW.date, 'purchase_payments'
    );

    -- Recalculate balance for the target treasury
    UPDATE public.treasuries
    SET balance = (
      SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
      FROM public.treasury_transactions
      WHERE treasury_id = NEW.treasury_id
    )
    WHERE id = NEW.treasury_id;

    -- Update balance_after
    UPDATE public.treasury_transactions
    SET balance_after = (SELECT balance FROM public.treasuries WHERE id = NEW.treasury_id)
    WHERE reference_id = NEW.id AND reference_type = 'purchase_payment';

    -- Recalculate total paid on the purchase
    -- Note: We sum both the original paid_amount (at insert) + all payment records.
    -- However, to keep it clean, the purchase_payments should represent the actual payments.
    -- We update the purchase's paid_amount to reflect the sum of all purchase_payments.
    SELECT COALESCE(SUM(amount), 0)
    INTO total_paid
    FROM public.purchase_payments
    WHERE purchase_id = NEW.purchase_id;

    new_status := CASE
      WHEN total_paid >= purchase_total THEN 'paid'
      WHEN total_paid > 0 THEN 'partial'
      ELSE 'due'
    END;

    UPDATE public.purchases
    SET paid_amount = total_paid, status = new_status
    WHERE id = NEW.purchase_id;

  ELSIF TG_OP = 'DELETE' THEN
    -- Delete transaction
    DELETE FROM public.treasury_transactions
    WHERE reference_id = OLD.id AND reference_type = 'purchase_payment';

    -- Recalculate balance for treasury
    UPDATE public.treasuries
    SET balance = (
      SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
      FROM public.treasury_transactions
      WHERE treasury_id = OLD.treasury_id
    )
    WHERE id = OLD.treasury_id;

    -- Recalculate total paid
    SELECT COALESCE(SUM(amount), 0)
    INTO total_paid
    FROM public.purchase_payments
    WHERE purchase_id = OLD.purchase_id;

    SELECT total_amount INTO purchase_total
    FROM public.purchases WHERE id = OLD.purchase_id;

    new_status := CASE
      WHEN total_paid >= purchase_total THEN 'paid'
      WHEN total_paid > 0 THEN 'partial'
      ELSE 'due'
    END;

    UPDATE public.purchases
    SET paid_amount = total_paid, status = new_status
    WHERE id = OLD.purchase_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Wire trigger for purchase_payments
DROP TRIGGER IF EXISTS trg_sync_purchase_payment ON public.purchase_payments;
CREATE TRIGGER trg_sync_purchase_payment
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_purchase_payment_sync();


-- 4. Trigger function for expenses sync to treasury
CREATE OR REPLACE FUNCTION public.handle_expense_treasury_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Delete existing transaction if updating
    IF TG_OP = 'UPDATE' THEN
      DELETE FROM public.treasury_transactions
      WHERE reference_id = NEW.id AND reference_type = 'expense';
    END IF;

    -- Create withdrawal if treasury is selected and amount > 0
    IF NEW.treasury_id IS NOT NULL AND NEW.amount > 0 THEN
      INSERT INTO public.treasury_transactions (
        treasury_id, type, amount, balance_after, description,
        reference_id, reference_type, date, source
      ) VALUES (
        NEW.treasury_id, 'withdrawal', NEW.amount, 0,
        'مصروف: ' || NEW.description,
        NEW.id, 'expense', NEW.date, 'expenses'
      );

      -- Recalculate treasury balance
      UPDATE public.treasuries
      SET balance = (
        SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
        FROM public.treasury_transactions
        WHERE treasury_id = NEW.treasury_id
      )
      WHERE id = NEW.treasury_id;

      -- Update balance_after
      UPDATE public.treasury_transactions
      SET balance_after = (SELECT balance FROM public.treasuries WHERE id = NEW.treasury_id)
      WHERE reference_id = NEW.id AND reference_type = 'expense';
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.treasury_transactions
    WHERE reference_id = OLD.id AND reference_type = 'expense';

    IF OLD.treasury_id IS NOT NULL THEN
      UPDATE public.treasuries
      SET balance = (
        SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
        FROM public.treasury_transactions
        WHERE treasury_id = OLD.treasury_id
      )
      WHERE id = OLD.treasury_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Wire trigger for expenses
DROP TRIGGER IF EXISTS trg_expense_treasury_sync ON public.expenses;
CREATE TRIGGER trg_expense_treasury_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.handle_expense_treasury_sync();
