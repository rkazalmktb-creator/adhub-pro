import { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, Plus, GripVertical, Image, Building2, MapPin, Upload, ClipboardPaste, DollarSign, Download, FileUp } from 'lucide-react';
import { useImageUpload } from '@/hooks/useImageUpload';

interface ExportSlide {
  id: string;
  title: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
}

interface ExportCompanyImage {
  id: string;
  company_name: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
}

interface ExportCityImage {
  id: string;
  city_name: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
}

export default function ExportContentSettings() {
  const [slides, setSlides] = useState<ExportSlide[]>([]);
  const [companies, setCompanies] = useState<ExportCompanyImage[]>([]);
  const [cities, setCities] = useState<ExportCityImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [pricingBusy, setPricingBusy] = useState(false);
  const pricingFileRef = useRef<HTMLInputElement>(null);
  const { uploadImageToFolder, uploadingImage } = useImageUpload();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [slidesRes, companiesRes, citiesRes] = await Promise.all([
        supabase.from('export_slides').select('*').order('sort_order'),
        supabase.from('export_company_images').select('*').order('sort_order'),
        supabase.from('export_city_images').select('*').order('sort_order'),
      ]);
      if (slidesRes.data) setSlides(slidesRes.data);
      if (companiesRes.data) setCompanies(companiesRes.data);
      if (citiesRes.data) setCities(citiesRes.data);
    } catch (e) {
      console.error(e);
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ===== Slides CRUD =====
  const addSlide = async () => {
    const maxOrder = slides.length > 0 ? Math.max(...slides.map(s => s.sort_order)) + 1 : 0;
    const { data, error } = await supabase.from('export_slides').insert({
      title: 'سلايد جديد', image_url: '', sort_order: maxOrder, is_active: true,
    }).select().single();
    if (error) { toast.error('فشل في الإضافة'); return; }
    if (data) setSlides(prev => [...prev, data]);
    toast.success('تم إضافة سلايد جديد');
  };

  const updateSlide = async (id: string, updates: Partial<ExportSlide>) => {
    const { error } = await supabase.from('export_slides').update(updates).eq('id', id);
    if (error) { toast.error('فشل في التحديث'); return; }
    setSlides(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteSlide = async (id: string) => {
    const { error } = await supabase.from('export_slides').delete().eq('id', id);
    if (error) { toast.error('فشل في الحذف'); return; }
    setSlides(prev => prev.filter(s => s.id !== id));
    toast.success('تم الحذف');
  };

  // ===== Companies CRUD =====
  const addCompany = async () => {
    const maxOrder = companies.length > 0 ? Math.max(...companies.map(c => c.sort_order)) + 1 : 0;
    const { data, error } = await supabase.from('export_company_images').insert({
      company_name: 'شركة جديدة', image_url: '', sort_order: maxOrder, is_active: true,
    }).select().single();
    if (error) { toast.error('فشل في الإضافة'); return; }
    if (data) setCompanies(prev => [...prev, data]);
    toast.success('تم إضافة شركة جديدة');
  };

  const updateCompany = async (id: string, updates: Partial<ExportCompanyImage>) => {
    const { error } = await supabase.from('export_company_images').update(updates).eq('id', id);
    if (error) { toast.error('فشل في التحديث'); return; }
    setCompanies(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteCompany = async (id: string) => {
    const { error } = await supabase.from('export_company_images').delete().eq('id', id);
    if (error) { toast.error('فشل في الحذف'); return; }
    setCompanies(prev => prev.filter(c => c.id !== id));
    toast.success('تم الحذف');
  };

  // ===== Cities CRUD =====
  const addCity = async () => {
    const maxOrder = cities.length > 0 ? Math.max(...cities.map(c => c.sort_order)) + 1 : 0;
    const { data, error } = await supabase.from('export_city_images').insert({
      city_name: 'مدينة جديدة', image_url: '', sort_order: maxOrder, is_active: true,
    }).select().single();
    if (error) { toast.error('فشل في الإضافة'); return; }
    if (data) setCities(prev => [...prev, data]);
    toast.success('تم إضافة مدينة جديدة');
  };

  const updateCity = async (id: string, updates: Partial<ExportCityImage>) => {
    const { error } = await supabase.from('export_city_images').update(updates).eq('id', id);
    if (error) { toast.error('فشل في التحديث'); return; }
    setCities(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteCity = async (id: string) => {
    const { error } = await supabase.from('export_city_images').delete().eq('id', id);
    if (error) { toast.error('فشل في الحذف'); return; }
    setCities(prev => prev.filter(c => c.id !== id));
    toast.success('تم الحذف');
  };

  // ===== Image Upload Handler =====
  const handleImageUpload = async (
    file: File,
    itemId: string,
    itemName: string,
    type: 'slide' | 'company' | 'city'
  ) => {
    const url = await uploadImageToFolder(file, itemName, `export-${type}`);
    if (typeof url === 'string') {
      if (type === 'slide') updateSlide(itemId, { image_url: url });
      else if (type === 'company') updateCompany(itemId, { image_url: url });
      else updateCity(itemId, { image_url: url });
    }
  };

  // ===== Pricing Excel Download / Upload =====
  const downloadPricingExcel = async () => {
    setPricingBusy(true);
    try {
      const { data, error } = await supabase
        .from('export_pricing')
        .select('*')
        .order('id');
      if (error) throw error;
      const rows = (data || []).map((r: any) => ({
        id: r.id,
        size: r.size,
        billboard_level: r.billboard_level,
        customer_category: r.customer_category,
        one_day: r.one_day ?? 0,
        one_month: r.one_month ?? 0,
        '2_months': r['2_months'] ?? 0,
        '3_months': r['3_months'] ?? 0,
        '6_months': r['6_months'] ?? 0,
        full_year: r.full_year ?? 0,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'الأسعار');
      XLSX.writeFile(wb, `export_pricing_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('تم تنزيل ملف الأسعار');
    } catch (e: any) {
      console.error(e);
      toast.error('فشل تنزيل ملف الأسعار');
    } finally {
      setPricingBusy(false);
    }
  };

  const uploadPricingExcel = async (file: File) => {
    setPricingBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: 0 });
      if (rows.length === 0) {
        toast.error('الملف فارغ');
        return;
      }
      const num = (v: any) => {
        if (v === null || v === undefined || v === '') return 0;
        const n = Number(String(v).replace(/[^\d.-]/g, ''));
        return isNaN(n) ? 0 : n;
      };
      let updated = 0;
      let inserted = 0;
      for (const row of rows) {
        const payload: any = {
          size: String(row.size ?? '').trim(),
          billboard_level: String(row.billboard_level ?? '').trim(),
          customer_category: String(row.customer_category ?? '').trim(),
          one_day: num(row.one_day),
          one_month: num(row.one_month),
          '2_months': num(row['2_months']),
          '3_months': num(row['3_months']),
          '6_months': num(row['6_months']),
          full_year: num(row.full_year),
        };
        if (!payload.size || !payload.billboard_level || !payload.customer_category) continue;
        if (row.id) {
          const { error } = await supabase.from('export_pricing').update(payload).eq('id', Number(row.id));
          if (!error) updated++;
        } else {
          const { error } = await supabase.from('export_pricing').insert(payload);
          if (!error) inserted++;
        }
      }
      toast.success(`تم تحديث ${updated} وإضافة ${inserted} سجل`);
    } catch (e: any) {
      console.error(e);
      toast.error('فشل رفع الملف. تحقق من التنسيق');
    } finally {
      setPricingBusy(false);
      if (pricingFileRef.current) pricingFileRef.current.value = '';
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="container mx-auto p-4 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">إعدادات محتوى التصدير</h1>
        <p className="text-muted-foreground text-sm mt-1">إدارة السلايدات وصور الشركات والمدن المضافة لملف Excel عند التصدير</p>
      </div>

      <Tabs defaultValue="slides" dir="rtl">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="slides" className="gap-2"><Image className="h-4 w-4" />السلايدات</TabsTrigger>
          <TabsTrigger value="companies" className="gap-2"><Building2 className="h-4 w-4" />الشركات</TabsTrigger>
          <TabsTrigger value="cities" className="gap-2"><MapPin className="h-4 w-4" />المدن</TabsTrigger>
          <TabsTrigger value="pricing" className="gap-2"><DollarSign className="h-4 w-4" />الأسعار</TabsTrigger>
        </TabsList>

        {/* ===== Slides Tab ===== */}
        <TabsContent value="slides" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">السلايدات</h2>
            <Button onClick={addSlide} size="sm" className="gap-2"><Plus className="h-4 w-4" />إضافة سلايد</Button>
          </div>
          {slides.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">لا توجد سلايدات.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {slides.map((slide) => (
                <ItemCard
                  key={slide.id}
                  imageUrl={slide.image_url}
                  onDelete={() => deleteSlide(slide.id)}
                  onUpload={(file) => handleImageUpload(file, slide.id, slide.title, 'slide')}
                  uploading={uploadingImage}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">العنوان</Label>
                      <Input value={slide.title} onChange={(e) => updateSlide(slide.id, { title: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">رابط الصورة</Label>
                      <Input value={slide.image_url} onChange={(e) => updateSlide(slide.id, { image_url: e.target.value })} dir="ltr" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">الترتيب</Label>
                      <Input type="number" value={slide.sort_order} onChange={(e) => updateSlide(slide.id, { sort_order: parseInt(e.target.value) || 0 })} className="w-20" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={slide.is_active} onCheckedChange={(checked) => updateSlide(slide.id, { is_active: checked })} />
                      <Label className="text-xs">{slide.is_active ? 'مفعّل' : 'معطّل'}</Label>
                    </div>
                  </div>
                </ItemCard>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ===== Companies Tab ===== */}
        <TabsContent value="companies" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">صور الشركات</h2>
            <Button onClick={addCompany} size="sm" className="gap-2"><Plus className="h-4 w-4" />إضافة شركة</Button>
          </div>
          {companies.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">لا توجد شركات.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {companies.map((company) => (
                <ItemCard
                  key={company.id}
                  imageUrl={company.image_url}
                  onDelete={() => deleteCompany(company.id)}
                  onUpload={(file) => handleImageUpload(file, company.id, company.company_name, 'company')}
                  uploading={uploadingImage}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">اسم الشركة</Label>
                      <Input value={company.company_name} onChange={(e) => updateCompany(company.id, { company_name: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">رابط الصورة</Label>
                      <Input value={company.image_url} onChange={(e) => updateCompany(company.id, { image_url: e.target.value })} dir="ltr" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">الترتيب</Label>
                      <Input type="number" value={company.sort_order} onChange={(e) => updateCompany(company.id, { sort_order: parseInt(e.target.value) || 0 })} className="w-20" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={company.is_active} onCheckedChange={(checked) => updateCompany(company.id, { is_active: checked })} />
                      <Label className="text-xs">{company.is_active ? 'مفعّل' : 'معطّل'}</Label>
                    </div>
                  </div>
                </ItemCard>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ===== Cities Tab ===== */}
        <TabsContent value="cities" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">صور المدن</h2>
            <Button onClick={addCity} size="sm" className="gap-2"><Plus className="h-4 w-4" />إضافة مدينة</Button>
          </div>
          {cities.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">لا توجد مدن.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {cities.map((city) => (
                <ItemCard
                  key={city.id}
                  imageUrl={city.image_url}
                  onDelete={() => deleteCity(city.id)}
                  onUpload={(file) => handleImageUpload(file, city.id, city.city_name, 'city')}
                  uploading={uploadingImage}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">اسم المدينة</Label>
                      <Input value={city.city_name} onChange={(e) => updateCity(city.id, { city_name: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">رابط الصورة</Label>
                      <Input value={city.image_url} onChange={(e) => updateCity(city.id, { image_url: e.target.value })} dir="ltr" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">الترتيب</Label>
                      <Input type="number" value={city.sort_order} onChange={(e) => updateCity(city.id, { sort_order: parseInt(e.target.value) || 0 })} className="w-20" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={city.is_active} onCheckedChange={(checked) => updateCity(city.id, { is_active: checked })} />
                      <Label className="text-xs">{city.is_active ? 'مفعّل' : 'معطّل'}</Label>
                    </div>
                  </div>
                </ItemCard>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ===== Pricing Tab ===== */}
        <TabsContent value="pricing" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  أسعار التصدير (export_pricing)
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  حمّل ملف Excel للأسعار الحالية، عدّله ثم أعد رفعه. يتم التحديث حسب عمود <code className="text-xs bg-muted px-1 rounded">id</code>، والصفوف بدون id تُضاف كجديدة.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  الأعمدة المطلوبة: <code>id</code>، <code>size</code>، <code>billboard_level</code>، <code>customer_category</code>، <code>one_day</code>، <code>one_month</code>، <code>2_months</code>، <code>3_months</code>، <code>6_months</code>، <code>full_year</code>
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={downloadPricingExcel} disabled={pricingBusy} className="gap-2">
                  <Download className="h-4 w-4" />
                  {pricingBusy ? 'جاري...' : 'تنزيل الأسعار Excel'}
                </Button>
                <input
                  ref={pricingFileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadPricingExcel(f);
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => pricingFileRef.current?.click()}
                  disabled={pricingBusy}
                  className="gap-2"
                >
                  <FileUp className="h-4 w-4" />
                  {pricingBusy ? 'جاري الرفع...' : 'رفع ملف الأسعار المعدّل'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ===== Reusable Item Card Component =====
function ItemCard({ 
  imageUrl, onDelete, onUpload, uploading, children 
}: { 
  imageUrl: string;
  onDelete: () => void;
  onUpload: (file: File) => void;
  uploading: boolean;
  children: React.ReactNode;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard || !(navigator.clipboard as any).read) {
        toast.error('المتصفح لا يدعم اللصق من الحافظة');
        return;
      }
      const items = await (navigator.clipboard as any).read();
      for (const item of items) {
        const imgType = item.types.find((t: string) => t.startsWith('image/'));
        if (imgType) {
          const blob = await item.getType(imgType);
          const ext = imgType.split('/')[1] || 'png';
          const file = new File([blob], `pasted-${Date.now()}.${ext}`, { type: imgType });
          onUpload(file);
          toast.success('تم لصق الصورة');
          return;
        }
      }
      toast.error('لا توجد صورة في الحافظة');
    } catch (e: any) {
      console.error(e);
      toast.error('فشل اللصق. تأكد من الإذن');
    }
  };

  return (
    <Card
      className="border"
      onPaste={(e) => {
        const file = Array.from(e.clipboardData?.files || []).find((f) => f.type.startsWith('image/'));
        if (file) {
          e.preventDefault();
          onUpload(file);
          toast.success('تم لصق الصورة');
        }
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <GripVertical className="h-5 w-5 text-muted-foreground mt-2 shrink-0 cursor-grab" />
          <div className="shrink-0 w-20 h-14 rounded border overflow-hidden flex items-center justify-center bg-muted">
            {imageUrl ? (
              <img src={imageUrl} alt="" className="w-full h-full object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
            ) : (
              <Image className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 space-y-2">
            {children}
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUpload(file);
                  e.target.value = '';
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="gap-2"
              >
                <Upload className="h-3 w-3" />
                {uploading ? 'جاري الرفع...' : 'رفع صورة'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePasteFromClipboard}
                disabled={uploading}
                className="gap-2"
                title="لصق صورة من الحافظة (Ctrl+V داخل البطاقة يعمل أيضاً)"
              >
                <ClipboardPaste className="h-3 w-3" />
                لصق من الحافظة
              </Button>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive shrink-0">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
