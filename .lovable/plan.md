
## 1) خلفية الهيدر السوداء في طباعة كشف العهدة

**السبب**: في جدول `print_settings` كل المستندات لها `header_bg_color = '#000000'`. عند توليد الـ HTML الموحّد:
```
.u-header { background: ${headerBgColor} !important; ... }
```
فيظهر الهيدر بخلفية سوداء.

**الإصلاح** (`src/lib/unifiedInvoiceBase.ts`):
- في `unifiedHeaderFooterCss`: عندما يكون `headerBgColor === '#000000'` ولون النص ليس فاتحاً مرئياً → اعتباره `'transparent'` (أو الإكتفاء بـ border-bottom كما هو). الأبسط: إذا الخلفية سوداء والنص أيضاً غامق → قلبها `transparent`. سنعتمد قاعدة آمنة: لو `headerBgColor` يساوي `#000`/`#000000` نضعها `transparent` تلقائياً (لأنها قيمة افتراضية تالفة قديمة).
- لتفادي الكسر، سنطبّق نفس المعالجة على ملف `src/lib/unifiedPrintFragments.ts` إن وُجد فيه نفس النمط.

(لن نلمس DB لأن المستخدم لم يطلب تغيير الإعداد، نعالج العرض فقط.)

## 2) رفع فاتورة المصروف + تعديل المصروف

**Migration**: إضافة عمودين إلى `custody_expenses`:
- `receipt_image_url text`
- `receipt_image_path text`

**`src/pages/CustodyManagement.tsx`**:
- إضافة state: `expenseReceiptImageUrl`, `expenseReceiptImagePath`.
- في Dialog إضافة/تعديل المصروف: حقل رفع صورة (يستخدم `imageUploadService` الموجود) + معاينة + زر إزالة.
- في `handleAddExpense` (insert/update): تمرير `receipt_image_url` و`receipt_image_path`.
- في `handleEditExpense`: تعبئة الحقول من السجل.
- زر "تعديل" موجود فعلاً في القائمة؛ نتأكد من ظهوره وعمله مع الصورة.

**`src/components/custody/CustodyStatementPrint.tsx`**:
- جلب `receipt_image_url` ضمن استعلام `custody_expenses`.
- إضافة عمود "الإيصال" أو رابط/مصغّرة صورة في الجدول للمصروفات التي لها صورة (img داخل خلية صغيرة 40×40 + رابط نقر للتكبير عند الطباعة العادية ينطبع كصورة فقط).

## 3) "المتبقي" مختلف بين صفحة الدفعات وصفحة العميل

**السبب**: `PaymentsReceiptsPage.tsx > fetchAllFinancialData` لا يجلب:
- `composite_tasks` (تُحتسب كديون في صفحة العميل)
- `friend_rental_data` (تُخصم من الديون في صفحة العميل)
- ولا يستثني `included_in_contract === true` من فواتير الطباعة (يجلب فقط `customer_id, total_amount`)

فينتج رقم متبقي مختلف. النتيجة: 90.25 في الدفعات بينما 0 في صفحة العميل.

**الإصلاح** (`src/pages/PaymentsReceiptsPage.tsx`):
- توسيع `fetchAllFinancialData` لجلب:
  - `printed_invoices`: تضمين `id, included_in_contract, print_cost, combined_invoice_id` + استثناء المضمّنة في العقود.
  - `composite_tasks`: `customer_id, customer_total, combined_invoice_id`.
  - `Contract.friend_rental_data` لاحتساب `friendRentals` لكل عميل.
- استبدال نداء `calculateTotalRemainingDebt` لاستخدام نفس التوقيع المستخدم في `useCustomerFinancials.calculateCustomerFinancials` (تمرير `compositeTasks` و`friendRentals`).
- النتيجة: نفس الرقم في الصفحتين.

## 4) المتبقي حسب ترتيب الدفعات (وليس اللحظة الحالية)

**السلوك الحالي**: يُحسب `remaining_debt` كقيمة عميل إجمالية واحدة لكل صف → كل دفعات نفس العميل تُظهر نفس الرقم.

**المطلوب**: المتبقي تراكمي مرتّب حسب تاريخ الدفع تصاعدياً:
- إجمالي الديون للعميل ثابت = `totalDebt - discounts - purchases - friendRentals`
- نرتّب دفعات/قيود العميل تصاعدياً (الأقدم أولاً).
- نطرح من المتبقي قيمة كل قيد (دفعة تخفّض، دين يضيف) بالترتيب.
- نخزّن `remaining_after` لكل قيد، ثم نعرض الجدول بالترتيب التنازلي كالحالي.

**الإصلاح** (`src/pages/PaymentsReceiptsPage.tsx > calculateBalances`):
- لكل عميل: حساب `baseRemaining = totalDebt(customer) - totalDiscounts - totalPurchasesNet` (بدون أي دفعة).
- ترتيب دفعات العميل تصاعدياً بـ `paid_at`.
- التكرار وتنزيل/زيادة المتبقي قيداً قيداً وتسجيل `remaining_debt` عليها.
- إعادة الدمج مع باقي الصفوف (الترتيب التنازلي للعرض كما هو).

## ملفات سيتم تعديلها / إنشاؤها

- migration جديدة: إضافة `receipt_image_url`, `receipt_image_path` إلى `custody_expenses`
- `src/lib/unifiedInvoiceBase.ts` (ربما `unifiedPrintFragments.ts`) — تطبيع الخلفية السوداء
- `src/pages/CustodyManagement.tsx` — رفع الصورة + تعديل
- `src/components/custody/CustodyStatementPrint.tsx` — عرض الصورة في الجدول
- `src/pages/PaymentsReceiptsPage.tsx` — توحيد الحساب + المتبقي التراكمي
