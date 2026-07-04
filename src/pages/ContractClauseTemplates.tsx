import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Plus, Edit, Trash2, Shield, Banknote,
  Wrench, Scale, AlertTriangle, BookOpen, Search, Eye, X,
  GripVertical, CheckCircle2, XCircle, Hash,
} from "lucide-react";

/* ─── Category configuration ─────────────────────────────────── */
const categoryConfig: Record<string, {
  label: string;
  icon: any;
  bgClass: string;
  borderClass: string;
  badgeClass: string;
  iconBg: string;
  statBg: string;
}> = {
  general:   { label: "عام",    icon: BookOpen,       bgClass: "bg-blue-50/60 dark:bg-blue-950/20",   borderClass: "border-blue-200/70 dark:border-blue-800/40",   badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",   iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",   statBg: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  financial: { label: "مالي",   icon: Banknote,       bgClass: "bg-emerald-50/60 dark:bg-emerald-950/20", borderClass: "border-emerald-200/70 dark:border-emerald-800/40", badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", statBg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  technical: { label: "فني",    icon: Wrench,         bgClass: "bg-purple-50/60 dark:bg-purple-950/20",  borderClass: "border-purple-200/70 dark:border-purple-800/40",  badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",  iconBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400",  statBg: "bg-purple-500/10 text-purple-700 dark:text-purple-300" },
  warranty:  { label: "ضمان",   icon: Shield,         bgClass: "bg-amber-50/60 dark:bg-amber-950/20",   borderClass: "border-amber-200/70 dark:border-amber-800/40",   badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",   iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",   statBg: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  safety:    { label: "سلامة",  icon: AlertTriangle,  bgClass: "bg-red-50/60 dark:bg-red-950/20",      borderClass: "border-red-200/70 dark:border-red-800/40",      badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",      iconBg: "bg-red-500/10 text-red-600 dark:text-red-400",      statBg: "bg-red-500/10 text-red-700 dark:text-red-300" },
  legal:     { label: "قانوني", icon: Scale,          bgClass: "bg-slate-50/60 dark:bg-slate-950/20",   borderClass: "border-slate-200/70 dark:border-slate-800/40",   badgeClass: "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300",   iconBg: "bg-slate-500/10 text-slate-600 dark:text-slate-400",   statBg: "bg-slate-500/10 text-slate-700 dark:text-slate-300" },
};

/* ─── Types ──────────────────────────────────────────────────── */
type ClauseTemplate = {
  id: string;
  title: string;
  content: string;
  category: string;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/* ─── Component ──────────────────────────────────────────────── */
export default function ContractClauseTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen]       = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen]   = useState(false);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewItem, setPreviewItem] = useState<ClauseTemplate | null>(null);

  /* Form state */
  const [title, setTitle]         = useState("");
  const [content, setContent]     = useState("");
  const [category, setCategory]   = useState("general");
  const [orderIndex, setOrderIndex] = useState(0);
  const [isActive, setIsActive]   = useState(true);

  /* ── Data fetching ─────────────────────────────────────────── */
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["contract-clause-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_clause_templates")
        .select("*")
        .order("order_index");
      if (error) throw error;
      return data as ClauseTemplate[];
    },
  });

  /* ── Derived data ──────────────────────────────────────────── */
  const filtered = templates
    .filter((t) => filterCategory === "all" || t.category === filterCategory)
    .filter((t) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return t.title.toLowerCase().includes(q) || t.content.toLowerCase().includes(q);
    });

  const activeCount   = templates.filter((t) => t.is_active).length;
  const inactiveCount = templates.length - activeCount;

  /* ── Form helpers ──────────────────────────────────────────── */
  const resetForm = () => {
    setTitle("");
    setContent("");
    setCategory("general");
    setOrderIndex(templates.length + 1);
    setIsActive(true);
    setEditingId(null);
  };

  const openNewForm = () => {
    resetForm();
    setOrderIndex(templates.length + 1);
    setFormOpen(true);
  };

  const openEditForm = (t: ClauseTemplate) => {
    setEditingId(t.id);
    setTitle(t.title);
    setContent(t.content);
    setCategory(t.category);
    setOrderIndex(t.order_index);
    setIsActive(t.is_active);
    setFormOpen(true);
  };

  /* ── Mutations ─────────────────────────────────────────────── */
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { title, content, category, order_index: orderIndex, is_active: isActive };
      if (editingId) {
        const { error } = await supabase
          .from("contract_clause_templates").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("contract_clause_templates").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-clause-templates"] });
      toast({ title: editingId ? "تم تحديث البند بنجاح" : "تم إضافة البند بنجاح" });
      setFormOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contract_clause_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-clause-templates"] });
      toast({ title: "تم حذف البند" });
      setDeleteOpen(false);
      setSelectedId(null);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("contract_clause_templates").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-clause-templates"] });
    },
  });

  /* ── Loading state ─────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">جارٍ تحميل البنود...</span>
        </div>
      </div>
    );
  }

  /* ── Render ────────────────────────────────────────────────── */
  return (
    <div className="space-y-6" dir="rtl">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">البنود العامة</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              البنود المتكررة التي يمكن استخدامها في المشاريع
            </p>
          </div>
        </div>
        <Button className="gap-2 shrink-0 cursor-pointer" onClick={openNewForm}>
          <Plus className="h-4 w-4" />
          بند جديد
        </Button>
      </div>

      {/* ── Stats row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 border-border/60">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Hash className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground leading-none">{templates.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">إجمالي البنود</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border/60">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground leading-none">{activeCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">بنود مفعّلة</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border/60">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-slate-500/10 flex items-center justify-center shrink-0">
              <XCircle className="h-4 w-4 text-slate-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground leading-none">{inactiveCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">معطّلة</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border/60">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <BookOpen className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground leading-none">
                {Object.keys(categoryConfig).filter(k => templates.some(t => t.category === k)).length}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">تصنيفات مستخدمة</p>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Search + Filters ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث في البنود..."
            className="pr-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category filters */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterCategory("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer border ${
              filterCategory === "all"
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
            }`}
          >
            الكل ({templates.length})
          </button>
          {Object.entries(categoryConfig).map(([key, cfg]) => {
            const count = templates.filter((t) => t.category === key).length;
            if (count === 0) return null;
            const Icon = cfg.icon;
            return (
              <button
                key={key}
                onClick={() => setFilterCategory(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer border ${
                  filterCategory === key
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {cfg.label}
                <span className="opacity-70">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Results info ──────────────────────────────────────── */}
      {(searchQuery || filterCategory !== "all") && (
        <p className="text-xs text-muted-foreground -mt-2">
          عرض <span className="font-semibold text-foreground">{filtered.length}</span> بند
          {filtered.length !== templates.length && ` من أصل ${templates.length}`}
        </p>
      )}

      {/* ── Clauses list ──────────────────────────────────────── */}
      <div className="space-y-2.5">
        {filtered.map((tmpl) => {
          const cfg = categoryConfig[tmpl.category] || categoryConfig.general;
          const Icon = cfg.icon;
          return (
            <Card
              key={tmpl.id}
              className={`
                border transition-all duration-200
                ${cfg.bgClass} ${cfg.borderClass}
                ${!tmpl.is_active ? "opacity-50 grayscale-[30%]" : "hover:shadow-md hover:shadow-primary/5"}
              `}
            >
              <div className="flex items-start gap-3 p-4">
                {/* Order + drag handle */}
                <div className="flex flex-col items-center gap-1 mt-0.5 shrink-0">
                  <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                  <span className="text-[10px] text-muted-foreground font-mono leading-none">
                    {String(tmpl.order_index).padStart(2, "0")}
                  </span>
                </div>

                {/* Category icon */}
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${cfg.iconBg}`}>
                  <Icon className="h-4.5 w-4.5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-foreground text-sm">{tmpl.title}</h3>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.badgeClass}`}>
                      <Icon className="h-2.5 w-2.5" />
                      {cfg.label}
                    </span>
                    {!tmpl.is_active && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                        <XCircle className="h-2.5 w-2.5" />
                        معطّل
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {tmpl.content}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0 mr-auto">
                  {/* Toggle active */}
                  <Switch
                    checked={tmpl.is_active}
                    onCheckedChange={(checked) =>
                      toggleActiveMutation.mutate({ id: tmpl.id, active: checked })
                    }
                  />

                  {/* Preview */}
                  <button
                    title="معاينة"
                    onClick={() => setPreviewItem(tmpl)}
                    className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-150 cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>

                  {/* Edit */}
                  <button
                    title="تعديل"
                    onClick={() => openEditForm(tmpl)}
                    className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-150 cursor-pointer"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>

                  {/* Delete */}
                  <button
                    title="حذف"
                    onClick={() => { setSelectedId(tmpl.id); setDeleteOpen(true); }}
                    className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-150 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* ── Empty state ───────────────────────────────────────── */}
      {filtered.length === 0 && (
        <Card className="p-16 text-center border-dashed">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <FileText className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            {searchQuery || filterCategory !== "all" ? "لا توجد نتائج" : "لا توجد بنود بعد"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchQuery
              ? `لم يُعثر على بنود تطابق "${searchQuery}"`
              : filterCategory !== "all"
              ? "لا توجد بنود في هذا التصنيف"
              : "أضف أول بند عام لاستخدامه في المشاريع"}
          </p>
          {!searchQuery && filterCategory === "all" && (
            <Button onClick={openNewForm} className="gap-2 cursor-pointer">
              <Plus className="h-4 w-4" />
              إضافة بند
            </Button>
          )}
          {(searchQuery || filterCategory !== "all") && (
            <Button
              variant="outline"
              onClick={() => { setSearchQuery(""); setFilterCategory("all"); }}
              className="gap-2 cursor-pointer"
            >
              مسح الفلاتر
            </Button>
          )}
        </Card>
      )}

      {/* ── Preview Dialog ─────────────────────────────────────── */}
      <Dialog open={!!previewItem} onOpenChange={() => setPreviewItem(null)}>
        <DialogContent className="max-w-xl" dir="rtl">
          {previewItem && (() => {
            const cfg = categoryConfig[previewItem.category] || categoryConfig.general;
            const Icon = cfg.icon;
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${cfg.iconBg}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-right">
                      <DialogTitle className="text-lg">{previewItem.title}</DialogTitle>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium mt-1 ${cfg.badgeClass}`}>
                        <Icon className="h-2.5 w-2.5" />
                        {cfg.label}
                      </span>
                    </div>
                  </div>
                </DialogHeader>
                <div className={`rounded-xl p-4 border text-sm leading-loose whitespace-pre-wrap text-foreground ${cfg.bgClass} ${cfg.borderClass}`}>
                  {previewItem.content}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span>الترتيب: {previewItem.order_index}</span>
                  <span className={`flex items-center gap-1 ${previewItem.is_active ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {previewItem.is_active ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {previewItem.is_active ? "مفعّل" : "معطّل"}
                  </span>
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setPreviewItem(null)} className="cursor-pointer">
                    إغلاق
                  </Button>
                  <Button onClick={() => { openEditForm(previewItem); setPreviewItem(null); }} className="gap-2 cursor-pointer">
                    <Edit className="h-4 w-4" />
                    تعديل
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Add / Edit Form Dialog ─────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-4.5 w-4.5 text-primary" />
              </div>
              <div className="text-right">
                <DialogTitle>{editingId ? "تعديل البند" : "إضافة بند جديد"}</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  {editingId ? "عدّل تفاصيل هذا البند" : "أضف بندًا جديدًا للاستخدام في المشاريع"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Title */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                عنوان البند <span className="text-destructive">*</span>
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: نطاق الأعمال"
                className="text-right"
              />
            </div>

            {/* Category + Order */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">التصنيف</Label>
                <Select value={category} onValueChange={setCategory} dir="rtl">
                  <SelectTrigger className="text-right">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {Object.entries(categoryConfig).map(([key, cfg]) => {
                      const Icon = cfg.icon;
                      return (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5" />
                            {cfg.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">رقم الترتيب</Label>
                <Input
                  type="number"
                  value={orderIndex}
                  onChange={(e) => setOrderIndex(Number(e.target.value))}
                  min={1}
                  className="text-left"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Content */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                محتوى البند <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="اكتب نص البند هنا..."
                rows={7}
                className="leading-relaxed resize-none text-right"
              />
              <p className="text-xs text-muted-foreground text-left" dir="ltr">{content.length} حرف</p>
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
              <Switch
                id="is-active-switch"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="is-active-switch" className="cursor-pointer flex-1">
                <span className="font-medium">تفعيل البند</span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  البنود المفعّلة تظهر عند إنشاء عقود جديدة
                </span>
              </Label>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                {isActive ? "مفعّل" : "معطّل"}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setFormOpen(false)} className="cursor-pointer">
              إلغاء
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !title.trim() || !content.trim()}
              className="gap-2 cursor-pointer"
            >
              {saveMutation.isPending ? (
                <>
                  <div className="h-4 w-4 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
                  جارٍ الحفظ...
                </>
              ) : editingId ? (
                <>
                  <Edit className="h-4 w-4" />
                  تحديث
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  إضافة
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ─────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div className="text-right">
                <DialogTitle>تأكيد الحذف</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  هذا الإجراء لا يمكن التراجع عنه
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            هل أنت متأكد من حذف هذا البند؟ سيتم إزالته نهائيًا ولن يظهر في أي عقد جديد.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="cursor-pointer">
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedId && deleteMutation.mutate(selectedId)}
              disabled={deleteMutation.isPending}
              className="gap-2 cursor-pointer"
            >
              {deleteMutation.isPending ? (
                <div className="h-4 w-4 rounded-full border-2 border-destructive-foreground/40 border-t-destructive-foreground animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              حذف البند
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
