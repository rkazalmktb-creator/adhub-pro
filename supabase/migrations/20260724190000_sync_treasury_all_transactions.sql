-- 1. إدراج حركات الخزينة المفقودة لدفعات الزبائن (client_payments)
INSERT INTO treasury_transactions (
  treasury_id,
  type,
  amount,
  balance_after,
  description,
  date,
  source,
  reference_type,
  reference_id,
  notes
)
SELECT 
  cp.treasury_id,
  'deposit',
  cp.amount,
  0,
  COALESCE('تسديد من الزبون: ' || c.name || COALESCE(' - مشروع: ' || p.name, ''), 'تسديد من الزبون'),
  cp.date,
  'client_payment',
  'client_payment',
  cp.id,
  cp.notes
FROM client_payments cp
LEFT JOIN clients c ON cp.client_id = c.id
LEFT JOIN projects p ON cp.project_id = p.id
WHERE cp.treasury_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM treasury_transactions tt 
    WHERE tt.reference_type = 'client_payment' AND tt.reference_id = cp.id
  );

-- 2. إدراج حركات الخزينة المفقودة لمدفوعات المشتريات / الموردين / الفنيين (purchase_payments)
INSERT INTO treasury_transactions (
  treasury_id,
  type,
  amount,
  balance_after,
  description,
  date,
  source,
  reference_type,
  reference_id,
  notes
)
SELECT 
  pp.treasury_id,
  'withdrawal',
  pp.amount,
  0,
  COALESCE(
    'سداد مدفوعات: ' || COALESCE(s.name, t.name, pur.title, 'مشتريات/خدمات') || COALESCE(' - مشروع: ' || p.name, ''),
    'سداد مشتريات/فنيين'
  ),
  pp.date,
  'purchase_payments',
  'purchase_payment',
  pp.id,
  pp.notes
FROM purchase_payments pp
JOIN purchases pur ON pp.purchase_id = pur.id
LEFT JOIN suppliers s ON pur.supplier_id = s.id
LEFT JOIN technicians t ON pur.technician_id = t.id
LEFT JOIN projects p ON pur.project_id = p.id
WHERE pp.treasury_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM treasury_transactions tt 
    WHERE tt.reference_type = 'purchase_payment' AND tt.reference_id = pp.id
  );

-- 3. إدراج حركات الخزينة المفقودة للمصروفات (expenses)
INSERT INTO treasury_transactions (
  treasury_id,
  type,
  amount,
  balance_after,
  description,
  date,
  source,
  reference_type,
  reference_id,
  notes
)
SELECT 
  e.treasury_id,
  'withdrawal',
  e.amount,
  0,
  COALESCE('مصروف: ' || e.description || COALESCE(' - مشروع: ' || p.name, ''), 'مصروفات'),
  e.date,
  'expense',
  'expense',
  e.id,
  e.notes
FROM expenses e
LEFT JOIN projects p ON e.project_id = p.id
WHERE e.treasury_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM treasury_transactions tt 
    WHERE tt.reference_type = 'expense' AND tt.reference_id = e.id
  );

-- 4. إعادة تحديث وحساب رصيد جميع الخزائن تلقائياً
UPDATE treasuries t
SET balance = (
  SELECT COALESCE(SUM(CASE WHEN tt.type = 'deposit' THEN tt.amount ELSE -tt.amount END), 0)
  FROM treasury_transactions tt
  WHERE tt.treasury_id = t.id
);
