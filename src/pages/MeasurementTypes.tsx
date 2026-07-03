import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ChevronRight,
  ArrowRight,
  Plus,
  Pencil,
  Trash2,
  Ruler,
  X,
  Calculator,
  Variable,
  Tag,
  Info,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";

interface MeasurementComponent {
  name: string;
  symbol: string;
  label: string;
}

interface MeasurementConfig {
  id: string;
  name: string;
  unit_symbol: string;
  components: MeasurementComponent[];
  formula: string | null;
  notes: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

const emptyFormData = {
  name: "",
  unit_symbol: "",
  components: [] as MeasurementComponent[],
  formula: "",
  notes: "",
};

const emptyComponent: MeasurementComponent = {
  name: "",
  symbol: "",
  label: "",
};

const MeasurementTypes = () => {
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<MeasurementConfig | null>(null);
  const [formData, setFormData] = useState(emptyFormData);
  const [newComponent, setNewComponent] = useState(emptyComponent);

  // Fetch measurement configs
  const { data: configs, isLoading } = useQuery({
    queryKey: ["measurement-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("measurement_configs")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return (data || []).map((item) => ({
        ...item,
        components: (item.components || []) as unknown as MeasurementComponent[],
      })) as MeasurementConfig[];
    },
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      const payload = {
        name: data.name,
        unit_symbol: data.unit_symbol,
        components: JSON.parse(JSON.stringify(data.components)) as Json,
        formula: data.formula || null,
        notes: data.notes || null,
      };

      if (data.id) {
        const { error } = await supabase
          .from("measurement_configs")
          .update(payload)
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("measurement_configs")
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["measurement-configs"] });
      handleResetForm();
      toast({
        title: editingItem ? "تم تحديث نوع القياس" : "تم إضافة نوع القياس",
        description: "تم حفظ البيانات بنجاح",
      });
    },
    onError: (error) => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حفظ البيانات",
        variant: "destructive",
      });
      console.error("Error saving measurement config:", error);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("measurement_configs")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["measurement-configs"] });
      toast({
        title: "تم الحذف",
        description: "تم حذف نوع القياس بنجاح",
      });
    },
    onError: (error) => {
      toast({
        title: "خطأ",
        description: "لا يمكن حذف نوع القياس لأنه مستخدم في بنود المشاريع",
        variant: "destructive",
      });
      console.error("Error deleting measurement config:", error);
    },
  });

  const handleResetForm = () => {
    setEditingItem(null);
    setFormData(emptyFormData);
    setNewComponent(emptyComponent);
  };

  const handleEdit = (config: MeasurementConfig) => {
    setEditingItem(config);
    setFormData({
      name: config.name,
      unit_symbol: config.unit_symbol,
      components: config.components || [],
      formula: config.formula || "",
      notes: config.notes || "",
    });
  };

  const handleAddComponent = () => {
    if (!newComponent.label.trim() || !newComponent.symbol.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى تعبئة التسمية والرمز للمكون",
        variant: "destructive",
      });
      return;
    }

    const cleanSymbol = newComponent.symbol.trim().toUpperCase();

    // Check for duplicate symbols
    if (formData.components.some(c => c.symbol === cleanSymbol)) {
      toast({
        title: "خطأ",
        description: "الرمز مستخدم بالفعل",
        variant: "destructive",
      });
      return;
    }

    // Auto-generate english name if empty
    const generatedName = newComponent.name.trim() || `component_${cleanSymbol.toLowerCase()}`;

    setFormData({
      ...formData,
      components: [...formData.components, { ...newComponent, name: generatedName, symbol: cleanSymbol }],
    });
    setNewComponent(emptyComponent);
  };

  const handleRemoveComponent = (index: number) => {
    const componentToRemove = formData.components[index];
    const newComponents = formData.components.filter((_, i) => i !== index);
    
    // Also clean up references in formula
    let updatedFormula = formData.formula;
    if (componentToRemove) {
      updatedFormula = updatedFormula.replace(new RegExp(componentToRemove.symbol, 'g'), '');
    }
    
    setFormData({ ...formData, components: newComponents, formula: updatedFormula });
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({
        title: "خطأ",
        description: "يجب إدخال اسم نوع القياس",
        variant: "destructive",
      });
      return;
    }

    if (!formData.unit_symbol.trim()) {
      toast({
        title: "خطأ",
        description: "يجب إدخال رمز الوحدة",
        variant: "destructive",
      });
      return;
    }

    if (formData.components.length === 0) {
      toast({
        title: "خطأ",
        description: "يجب إضافة مكون واحد على الأقل",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate({
      ...formData,
      id: editingItem?.id,
    });
  };

  const insertSymbolToFormula = (symbol: string) => {
    setFormData({
      ...formData,
      formula: formData.formula + symbol,
    });
  };

  // Preset layouts helper
  const applyPreset = (presetType: "linear" | "square" | "cubic") => {
    if (presetType === "linear") {
      setFormData({
        name: "متر طولي",
        unit_symbol: "م.ط",
        components: [{ name: "length", symbol: "L", label: "الطول" }],
        formula: "L",
        notes: "الضرب المباشر للطول فقط",
      });
    } else if (presetType === "square") {
      setFormData({
        name: "متر مربع",
        unit_symbol: "م²",
        components: [
          { name: "length", symbol: "L", label: "الطول" },
          { name: "width", symbol: "W", label: "العرض" }
        ],
        formula: "L * W",
        notes: "حساب المساحة ثنائية الأبعاد (الطول × العرض)",
      });
    } else if (presetType === "cubic") {
      setFormData({
        name: "متر مكعب",
        unit_symbol: "م³",
        components: [
          { name: "length", symbol: "L", label: "الطول" },
          { name: "width", symbol: "W", label: "العرض" },
          { name: "height", symbol: "H", label: "الارتفاع" }
        ],
        formula: "L * W * H",
        notes: "حساب الحجم ثلاثي الأبعاد (الطول × العرض × الارتفاع)",
      });
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/general-items" className="hover:text-foreground cursor-pointer transition-all duration-200">
          البنود العامة
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">أنواع القياس</span>
      </div>

      {/* Title */}
      <div className="flex items-center gap-4">
        <Link to="/general-items">
          <Button variant="outline" size="icon" className="cursor-pointer transition-all duration-200">
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">أنواع القياس والمعادلات</h1>
          <p className="text-muted-foreground">
            إدارة وتخصيص معادلات حساب الكميات والأبعاد لبنود الميزانية والمشاريع
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* RIGHT COLUMN: Add/Edit Form (col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-primary/20 shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2 text-primary">
                <Calculator className="h-5 w-5" />
                {editingItem ? "تعديل نوع القياس" : "إنشاء نوع قياس مخصص"}
              </CardTitle>
              <CardDescription>
                {editingItem 
                  ? `أنت تقوم بتعديل القياس: ${editingItem.name}` 
                  : "حدد المكونات وصيغة الحساب الرياضية للنوع الجديد"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Preset Buttons for Quick Start */}
              {!editingItem && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">نماذج سريعة جاهزة:</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-xs cursor-pointer" onClick={() => applyPreset("linear")}>
                      متر طولي (L)
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs cursor-pointer" onClick={() => applyPreset("square")}>
                      متر مربع (L×W)
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs cursor-pointer" onClick={() => applyPreset("cubic")}>
                      متر مكعب (L×W×H)
                    </Button>
                  </div>
                </div>
              )}

              {/* Name and Symbol */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name">الاسم بالعربية *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="مثال: متر مسطح"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="unit_symbol">رمز الوحدة *</Label>
                  <Input
                    id="unit_symbol"
                    value={formData.unit_symbol}
                    onChange={(e) => setFormData({ ...formData, unit_symbol: e.target.value })}
                    placeholder="مثال: م²"
                    className="h-9"
                  />
                </div>
              </div>

              {/* Components Builder */}
              <div className="space-y-3 p-3 rounded-lg border bg-muted/40">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold flex items-center gap-1.5 text-xs text-foreground">
                    <Variable className="h-4 w-4 text-primary" />
                    المكونات والأبعاد المطلوبة
                  </Label>
                  <Badge variant="outline" className="text-[10px] font-mono border-primary/20 bg-primary/5 text-primary">
                    {formData.components.length} مضاف
                  </Badge>
                </div>

                {/* List of Added Components */}
                {formData.components.length > 0 ? (
                  <div className="space-y-1.5">
                    {formData.components.map((comp, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded border bg-background text-sm transition-all hover:border-primary/30"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-primary">{comp.label}</span>
                          <Badge variant="secondary" className="font-mono text-xs">
                            {comp.symbol}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:bg-destructive/10 cursor-pointer"
                          onClick={() => handleRemoveComponent(idx)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs text-muted-foreground border border-dashed rounded bg-background">
                    لا توجد مكونات مضافة. أضف مكوناً بالأسفل.
                  </div>
                )}

                {/* Add Component Inputs Grid */}
                <div className="grid grid-cols-12 gap-1.5 pt-2 border-t mt-2">
                  <div className="col-span-5 space-y-1">
                    <Label className="text-[10px] text-muted-foreground">التسمية (عربي) *</Label>
                    <Input
                      className="h-8 text-xs"
                      value={newComponent.label}
                      onChange={(e) => setNewComponent({ ...newComponent, label: e.target.value })}
                      placeholder="العرض، العمق..."
                    />
                  </div>
                  <div className="col-span-4 space-y-1">
                    <Label className="text-[10px] text-muted-foreground">الرمز في المعادلة *</Label>
                    <Input
                      className="h-8 text-xs font-mono text-center"
                      value={newComponent.symbol}
                      onChange={(e) => setNewComponent({ ...newComponent, symbol: e.target.value.toUpperCase() })}
                      placeholder="W"
                      maxLength={3}
                    />
                  </div>
                  <div className="col-span-3 flex items-end">
                    <Button 
                      type="button" 
                      onClick={handleAddComponent} 
                      size="sm" 
                      className="w-full h-8 text-xs cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5 ml-0.5" />
                      أضف
                    </Button>
                  </div>
                </div>
              </div>

              {/* Equation formula section */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">صيغة المعادلة الحسابية</Label>
                
                {/* Operator and symbols pad */}
                {formData.components.length > 0 ? (
                  <div className="flex flex-wrap gap-1 p-2 rounded border bg-muted/30">
                    {formData.components.map((comp, idx) => (
                      <Button
                        key={idx}
                        variant="secondary"
                        size="sm"
                        className="h-7 text-xs font-mono gap-1 cursor-pointer"
                        onClick={() => insertSymbolToFormula(comp.symbol)}
                      >
                        {comp.symbol}
                      </Button>
                    ))}
                    <div className="h-5 w-px bg-border mx-1 my-auto"></div>
                    {[" * ", " + ", " - ", " / ", " ( ", " ) "].map((op) => (
                      <Button
                        key={op}
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 text-xs font-mono p-0 cursor-pointer"
                        onClick={() => insertSymbolToFormula(op)}
                      >
                        {op.trim() === "*" ? "×" : op.trim() === "/" ? "÷" : op.trim()}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">أضف مكونات لتفعيل لوحة الرموز المساعدة.</div>
                )}

                <Input
                  id="formula"
                  value={formData.formula}
                  onChange={(e) => setFormData({ ...formData, formula: e.target.value })}
                  placeholder="صيغة المعادلة، مثال: L * W"
                  className="font-mono text-left h-9 tracking-wider"
                  dir="ltr"
                />

                {/* Live Formula Preview */}
                {formData.formula && formData.components.length > 0 && (
                  <div className="p-2.5 bg-primary/5 rounded border border-primary/20 text-xs flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                      <Info className="h-3.5 w-3.5 text-primary" />
                      ترجمة المعادلة للمستخدم:
                    </span>
                    <code className="text-xs font-semibold text-primary font-mono" dir="rtl">
                      {formData.components.reduce(
                        (formula, comp) =>
                          formula.replace(
                            new RegExp(comp.symbol, "g"),
                            ` [ ${comp.label} ] `
                          ),
                        formData.formula
                      ).replace(/\*/g, "×").replace(/\//g, "÷")}
                    </code>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="notes">ملاحظات إضافية</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="ملاحظات حول طريقة الاستخدام أو تطبيق هذا النوع..."
                  rows={2}
                  className="resize-none"
                />
              </div>

              {/* Actions Footer */}
              <div className="flex gap-2 justify-end pt-3 border-t">
                {editingItem && (
                  <Button variant="outline" size="sm" onClick={handleResetForm} className="cursor-pointer">
                    إلغاء التعديل
                  </Button>
                )}
                <Button 
                  size="sm" 
                  onClick={handleSubmit} 
                  disabled={saveMutation.isPending} 
                  className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/95"
                >
                  {saveMutation.isPending ? "جاري الحفظ..." : editingItem ? "تحديث نوع القياس" : "إضافة نوع القياس"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* LEFT COLUMN: List of Configs (col-span-7) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Ruler className="h-5 w-5 text-primary" />
                أنواع القياس المعتمدة بالمنظومة
              </CardTitle>
              <CardDescription>
                أنواع القياس الافتراضية للكميات أو تلك التي تم تخصيصها بمعادلات رياضية فريدة.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                {configs?.map((config) => (
                  <div
                    key={config.id}
                    className={`p-4 rounded-xl border transition-all duration-200 ${
                      editingItem?.id === config.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/20 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-base flex items-center gap-2">
                          {config.name}
                          {config.is_default && (
                            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                              نظامي افتراضي
                            </Badge>
                          )}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">الوحدة: {config.unit_symbol}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                          onClick={() => handleEdit(config)}
                          title="تعديل"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {!config.is_default && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 cursor-pointer"
                            onClick={() => {
                              if (confirm("هل أنت متأكد من حذف هذا النوع؟ البنود المرتبطة به قد تتأثر.")) {
                                deleteMutation.mutate(config.id);
                              }
                            }}
                            title="حذف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Components Badges */}
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {config.components?.map((comp, idx) => (
                          <span 
                            key={idx} 
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-xs text-muted-foreground border font-medium"
                          >
                            <span>{comp.label}</span>
                            <code className="text-[10px] bg-background px-1 rounded font-bold text-foreground font-mono">
                              {comp.symbol}
                            </code>
                          </span>
                        ))}
                      </div>

                      {/* Formula display */}
                      {config.formula && (
                        <div className="flex items-center justify-between p-2 rounded bg-muted/50 border border-border/50 text-xs font-mono">
                          <span className="text-[10px] text-muted-foreground">صيغة المعادلة:</span>
                          <span className="font-bold text-foreground" dir="ltr">
                            {config.formula}
                          </span>
                        </div>
                      )}

                      {config.notes && (
                        <p className="text-xs text-muted-foreground/80 leading-relaxed pt-1">
                          {config.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MeasurementTypes;
