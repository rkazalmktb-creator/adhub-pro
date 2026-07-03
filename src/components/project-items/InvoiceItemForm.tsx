import React from "react";
import { 
  Plus, Pencil, X, Search, Tag, User, Users, Ruler, Layers, Calculator, Info 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

// Local labels and units
const rateTypeLabels: Record<string, string> = {
  meter: "بالمتر",
  piece: "بالقطعة",
  fixed: "مبلغ ثابت",
};

const measurementUnits = {
  linear: "م.ط",
  square: "م²",
  cubic: "م³",
};

const detectMeasurementType = (config: any): "linear" | "square" | "cubic" => {
  if (!config) return "linear";
  const symbol = config.unit_symbol || "";
  if (symbol.includes("²") || symbol.includes("2") || config.name.includes("مربع")) return "square";
  if (symbol.includes("³") || symbol.includes("3") || config.name.includes("مكعب")) return "cubic";
  return "linear";
};

interface InvoiceItemFormProps {
  projectId: string;
  editingItem: any;
  setEditingItem: (item: any) => void;
  inlineItem: any;
  setInlineItem: React.Dispatch<React.SetStateAction<any>>;
  calculationMethod: "manual" | "config";
  setCalculationMethod: (method: "manual" | "config") => void;
  inlineSearch: string;
  setInlineSearch: (search: string) => void;
  inlineDropdownOpen: boolean;
  setInlineDropdownOpen: (open: boolean) => void;
  editingItemTechnicians: any[];
  setEditingItemTechnicians: React.Dispatch<React.SetStateAction<any[]>>;
  generalItems?: any[];
  engineers?: any[];
  technicians?: any[];
  measurementConfigs?: any[];
  saveMutation: any;
  formRef: React.RefObject<HTMLDivElement | null>;
  nameInputRef: React.RefObject<HTMLInputElement | null>;
  handleCancelEdit: () => void;
  inlineDropdownRef: React.RefObject<HTMLDivElement | null>;
}

export const InvoiceItemForm: React.FC<InvoiceItemFormProps> = ({
  projectId,
  editingItem,
  setEditingItem,
  inlineItem,
  setInlineItem,
  calculationMethod,
  setCalculationMethod,
  inlineSearch,
  setInlineSearch,
  inlineDropdownOpen,
  setInlineDropdownOpen,
  editingItemTechnicians,
  setEditingItemTechnicians,
  generalItems,
  engineers,
  technicians,
  measurementConfigs,
  saveMutation,
  formRef,
  nameInputRef,
  handleCancelEdit,
  inlineDropdownRef,
}) => {
  const queryClient = useQueryClient();

  // Calculate final quantities
  const qty = calculationMethod === "config" 
    ? (parseFloat(inlineItem.quantity) || 0) 
    : (parseFloat(inlineItem.quantity) || 0) * (parseFloat(inlineItem.item_count) || 1);
  const price = parseFloat(inlineItem.unit_price) || 0;
  const saleTotal = qty * price;
  
  // Technician Cost
  let inlineTechCost = 0;
  if (inlineItem.technician_id) {
    const techRate = parseFloat(inlineItem.technician_rate) || 0;
    const techRateType = inlineItem.technician_rate_type;
    if (techRateType === "fixed") {
      inlineTechCost = techRate;
    } else if (techRateType === "piece") {
      const pieceQty = parseFloat(inlineItem.technician_piece_qty) || 1;
      inlineTechCost = techRate * pieceQty;
    } else {
      inlineTechCost = techRate * qty;
    }
  }
  
  const existingTechsCost = editingItem 
    ? editingItemTechnicians.reduce((sum, t) => sum + (parseFloat(t.total_cost) || 0), 0)
    : 0;
  
  const totalCost = inlineTechCost + existingTechsCost;
  const netProfit = saleTotal - totalCost;
  const profitMargin = saleTotal > 0 ? (netProfit / saleTotal) * 100 : 0;

  return (
    <div 
      ref={formRef}
      className={`border-2 ${
        editingItem 
          ? 'border-[#d6ac40] bg-[#d6ac40]/5 dark:bg-[#d6ac40]/10 shadow-[0_0_15px_rgba(214,172,64,0.15)] animate-pulse-slow' 
          : 'border-border bg-card/60 backdrop-blur-sm shadow-md'
      } rounded-xl p-6 transition-all duration-300 mt-6`}
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${editingItem ? 'bg-[#d6ac40]/20 text-[#d6ac40]' : 'bg-primary/10 text-primary'}`}>
            {editingItem ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="font-bold text-lg text-foreground">
              {editingItem ? `تعديل البند: ${editingItem.name}` : "إدخال بند جديد للمقاولات"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
              {editingItem ? "قم بتعديل مواصفات وأبعاد البند ثم انقر على تحديث البند" : "أدخل بيانات البند يدويًا أو ابحث في قائمة البنود العامة للاستيراد السريع"}
            </p>
          </div>
        </div>
        {editingItem && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleCancelEdit}
            className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors border-dashed text-xs cursor-pointer"
          >
            <X className="h-4 w-4 ml-1" />
            إلغاء التعديل
          </Button>
        )}
      </div>

      {/* Grid Layout: Column 1 (2/3) and Column 2 (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Column 1: Basic Info & Quantity calculations (ColSpan 2) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Block 1: Basic Information */}
          <div className="bg-secondary/20 p-4 rounded-lg border border-border/40 space-y-4">
            <h4 className="text-xs font-bold text-[#d6ac40] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              البيانات الأساسية للبند
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Item Name with Autocomplete */}
              <div className="relative" ref={inlineDropdownRef}>
                <Label className="text-xs font-semibold text-foreground mb-1.5 block">اسم البند <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    ref={nameInputRef}
                    value={inlineSearch || inlineItem.name}
                    onChange={(e) => {
                      setInlineSearch(e.target.value);
                      setInlineItem(prev => ({ ...prev, name: e.target.value, generalItemId: "" }));
                      setInlineDropdownOpen(true);
                    }}
                    onFocus={() => {
                      if (inlineSearch) setInlineDropdownOpen(true);
                    }}
                    placeholder="مثال: حفر القواعد، صب خرسانة، بناء طوب..."
                    className="h-11 pr-10 text-base"
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>

                {/* Styled Autocomplete Dropdown */}
                {inlineDropdownOpen && inlineSearch && (
                  <div className="absolute z-[9999] top-full left-0 right-0 mt-1.5 bg-popover text-popover-foreground border border-[#d6ac40]/20 rounded-lg shadow-2xl max-h-[280px] overflow-y-auto divide-y divide-border/50 animate-in fade-in slide-in-from-top-1">
                    {generalItems
                      ?.filter(gi => 
                        gi.name.toLowerCase().includes(inlineSearch.toLowerCase()) ||
                        (gi.category && gi.category.toLowerCase().includes(inlineSearch.toLowerCase()))
                      )
                      .slice(0, 8)
                      .map((gi) => {
                        const mc = gi.measurement_config_id ? measurementConfigs?.find(c => c.id === gi.measurement_config_id) : null;
                        const unitSymbol = mc ? mc.unit_symbol : measurementUnits[gi.measurement_type as "linear" | "square" | "cubic"];
                        return (
                          <button
                            key={gi.id}
                            type="button"
                            className="w-full text-right px-4 py-3 hover:bg-accent flex items-center justify-between gap-3 text-sm transition-colors cursor-pointer border-none bg-transparent"
                            onClick={() => {
                              setInlineItem(prev => ({
                                ...prev,
                                generalItemId: gi.id,
                                name: gi.name,
                                measurement_type: gi.measurement_type,
                                quantity: "",
                                unit_price: gi.default_unit_price.toString(),
                                measurement_config_id: gi.measurement_config_id || "",
                                component_values: {},
                                measurement_factor: "1",
                              }));
                              setCalculationMethod(gi.measurement_config_id ? "config" : "manual");
                              setInlineSearch("");
                              setInlineDropdownOpen(false);
                            }}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-foreground truncate">{gi.name}</p>
                              {gi.description && (
                                <p className="text-xs text-muted-foreground truncate">{gi.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {gi.category && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {gi.category}
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs border-[#d6ac40]/30 text-[#d6ac40] font-medium">
                                {unitSymbol} · {gi.default_unit_price.toLocaleString()} د.ل
                              </Badge>
                            </div>
                          </button>
                        );
                      })}
                    {generalItems?.filter(gi => 
                      gi.name.toLowerCase().includes(inlineSearch.toLowerCase())
                    ).length === 0 && (
                      <div className="px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                        <Info className="h-4 w-4 text-[#d6ac40]" />
                        <span>سيتم إنشاء بند مخصص باسم: "{inlineSearch}"</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Unit Price */}
              <div>
                <Label className="text-xs font-semibold text-foreground mb-1.5 block">سعر الوحدة للزبون (د.ل) <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={inlineItem.unit_price}
                    onChange={(e) => setInlineItem(prev => ({ ...prev, unit_price: e.target.value }))}
                    placeholder="0.00"
                    className="h-11 pl-12 text-base font-semibold"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">د.ل</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Custom Description */}
              <div>
                <Label className="text-xs font-semibold text-foreground mb-1.5 block">تسمية / وصف البند المخصص</Label>
                <Input
                  value={inlineItem.description}
                  onChange={(e) => setInlineItem(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="أدخل أي ملاحظات أو مواصفات خاصة بالبند..."
                  className="h-11"
                />
              </div>

              {/* Engineer Select */}
              <div>
                <Label className="text-xs font-semibold text-foreground mb-1.5 block">المهندس المشرف</Label>
                <Select
                  value={inlineItem.engineer_id || "none"}
                  onValueChange={(value) => setInlineItem(prev => ({ ...prev, engineer_id: value === "none" ? "" : value }))}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="اختر المهندس المسؤول عن الاستلام" />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    <SelectItem value="none">بدون مهندس (استلام مباشر)</SelectItem>
                    {engineers?.map((eng) => (
                      <SelectItem key={eng.id} value={eng.id}>
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-[#d6ac40]" />
                          <span className="font-medium">{eng.name}</span>
                          <span className="text-xs text-muted-foreground">({eng.engineer_type})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Block 2: Quantity Calculation Section */}
          <div className="bg-[#d6ac40]/5 p-4 rounded-lg border border-[#d6ac40]/10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
              <h4 className="text-xs font-bold text-[#d6ac40] uppercase tracking-wider flex items-center gap-1.5">
                <Calculator className="h-3.5 w-3.5" />
                طريقة احتساب كمية البند
              </h4>
              
              {/* Mode Toggle Tabs */}
              <div className="flex border border-border rounded-lg overflow-hidden p-0.5 bg-background text-xs font-semibold shrink-0">
                <button
                  type="button"
                  className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer border-none ${
                    calculationMethod === "manual" 
                      ? "bg-[#d6ac40] text-primary-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground bg-transparent"
                  }`}
                  onClick={() => {
                    setCalculationMethod("manual");
                    setInlineItem(prev => ({ ...prev, measurement_config_id: "" }));
                  }}
                >
                  <Ruler className="h-3.5 w-3.5" />
                  كمية مباشرة
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer border-none ${
                    calculationMethod === "config" 
                      ? "bg-[#d6ac40] text-primary-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground bg-transparent"
                  }`}
                  onClick={() => {
                    setCalculationMethod("config");
                    if (!inlineItem.measurement_config_id && measurementConfigs && measurementConfigs.length > 0) {
                      setInlineItem(prev => ({ ...prev, measurement_config_id: measurementConfigs[0].id }));
                    }
                  }}
                >
                  <Layers className="h-3.5 w-3.5" />
                  حساب تفصيلي بالأبعاد
                </button>
              </div>
            </div>

            {calculationMethod === "manual" ? (
              /* Manual quantity entry */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-foreground mb-1.5 block">الكمية للقطعة / البند</Label>
                  <Input
                    type="number"
                    value={inlineItem.quantity}
                    onChange={(e) => setInlineItem(prev => ({ ...prev, quantity: e.target.value }))}
                    placeholder="مثال: 5، 12.5"
                    className="h-11 text-base font-semibold"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-foreground mb-1.5 block">عدد العناصر (مضاعف التكرار)</Label>
                  <Input
                    type="number"
                    value={inlineItem.item_count}
                    onChange={(e) => setInlineItem(prev => ({ ...prev, item_count: e.target.value }))}
                    placeholder="1"
                    className="h-11 text-base"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">الكمية الإجمالية النهائية</Label>
                  <div className="h-11 bg-secondary/35 border border-border rounded-lg flex items-center justify-between px-3 text-base font-bold text-foreground">
                    <span>
                      {((parseFloat(inlineItem.quantity) || 0) * (parseFloat(inlineItem.item_count) || 1)).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </span>
                    <span className="text-xs text-muted-foreground font-semibold">وحدة</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Config-based dimension calculations */
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Config Selector */}
                  <div>
                    <Label className="text-xs font-semibold text-foreground mb-1.5 block">نوع القياس / المعادلة</Label>
                    <Select
                      value={inlineItem.measurement_config_id}
                      onValueChange={(val) => {
                        const mc = measurementConfigs?.find(c => c.id === val);
                        setInlineItem(prev => ({
                          ...prev,
                          measurement_config_id: val,
                          measurement_type: detectMeasurementType(mc || null),
                          component_values: {},
                        }));
                      }}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="اختر معادلة القياس" />
                      </SelectTrigger>
                      <SelectContent className="z-[9999]">
                        {measurementConfigs?.map((cfg) => (
                          <SelectItem key={cfg.id} value={cfg.id}>
                            {cfg.name} ({cfg.unit_symbol})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Formula Info Badge */}
                  <div className="flex items-end pb-1.5">
                    {(() => {
                      const inlineMC = measurementConfigs?.find(c => c.id === inlineItem.measurement_config_id);
                      if (!inlineMC) return null;
                      return (
                        <div className="bg-background/80 border border-border p-2.5 rounded-lg flex items-center gap-2 text-xs text-muted-foreground w-full">
                          <Calculator className="h-4 w-4 text-primary" />
                          <div>
                            <div>
                              <span className="font-semibold text-foreground">معادلة الاحتساب:</span>{" "}
                              <code className="bg-secondary px-1.5 py-0.5 rounded text-primary font-mono dir-ltr inline-block">
                                {inlineMC.formula || "الضرب المباشر للأبعاد"}
                              </code>
                            </div>
                            {inlineMC.formula && (
                              <div className="mt-1 text-[10px] text-muted-foreground">
                                أي:{" "}
                                <span className="font-semibold text-foreground">
                                  {inlineMC.components.reduce(
                                    (f: string, c: any) => f.replace(new RegExp(c.symbol, "g"), ` [ ${c.label} ] `),
                                    inlineMC.formula
                                  ).replace(/\*/g, "×").replace(/\//g, "÷")}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Dimension Fields Grid */}
                {(() => {
                  const inlineMC = measurementConfigs?.find(c => c.id === inlineItem.measurement_config_id);
                  if (!inlineMC || inlineMC.components.length === 0) {
                    return (
                      <p className="text-xs text-muted-foreground py-2 text-center font-medium">لا توجد أبعاد معرفة لهذه المعادلة.</p>
                    );
                  }
                  return (
                    <div className="bg-background/50 p-4 rounded-lg border border-border/40 grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {inlineMC.components.map((comp: any) => (
                        <div key={comp.symbol}>
                          <Label className="text-xs font-medium text-foreground mb-1 block">
                            {comp.label} ({comp.symbol})
                          </Label>
                          <Input
                            type="number"
                            value={inlineItem.component_values[comp.symbol] || ""}
                            onChange={(e) => {
                              const newValues = { ...inlineItem.component_values, [comp.symbol]: e.target.value };
                              setInlineItem(prev => ({ 
                                ...prev, 
                                component_values: newValues
                              }));
                            }}
                            placeholder="0.00"
                            className="h-10 text-base font-semibold"
                          />
                        </div>
                      ))}
                      
                      {/* Factor Multiplier */}
                      <div>
                        <Label className="text-xs font-medium text-foreground mb-1 block">معامل الضرب</Label>
                        <Input
                          type="number"
                          value={inlineItem.measurement_factor}
                          onChange={(e) => setInlineItem(prev => ({ ...prev, measurement_factor: e.target.value }))}
                          placeholder="1"
                          className="h-10 text-base"
                        />
                      </div>

                      {/* Count Multiplier */}
                      <div>
                        <Label className="text-xs font-medium text-foreground mb-1 block">عدد العناصر</Label>
                        <Input
                          type="number"
                          value={inlineItem.item_count}
                          onChange={(e) => setInlineItem(prev => ({ ...prev, item_count: e.target.value }))}
                          placeholder="1"
                          className="h-10 text-base"
                        />
                      </div>

                      {/* Result Display */}
                      <div className="col-span-2 sm:col-span-2">
                        <Label className="text-xs font-bold text-[#d6ac40] mb-1 block">
                          الكمية الكلية المحسوبة ({inlineMC.unit_symbol})
                        </Label>
                        <div className="h-10 bg-[#d6ac40]/10 border border-[#d6ac40]/20 rounded-lg flex items-center justify-between px-3 text-base font-bold text-[#d6ac40]">
                          <span className="animate-pulse-slow">
                            {parseFloat(inlineItem.quantity) ? (parseFloat(inlineItem.quantity)).toLocaleString(undefined, { maximumFractionDigits: 4 }) : "0"}
                          </span>
                          <span className="text-xs font-medium text-[#d6ac40]/70">{inlineMC.unit_symbol}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Technician Assignment (ColSpan 1) */}
        <div className="bg-secondary/10 p-4 rounded-lg border border-border/40 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-[#d6ac40] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              تعيينات الفنيين المباشرة
            </h4>
            
            {/* Select Technician */}
            <div>
              <Label className="text-xs font-semibold text-foreground mb-1.5 block">
                {editingItem && editingItemTechnicians.length > 0 ? "تعيين فني إضافي" : "الفني المعين للبند"}
              </Label>
              <Select
                value={inlineItem.technician_id || "none"}
                onValueChange={(value) => setInlineItem(prev => ({ 
                  ...prev, 
                  technician_id: value === "none" ? "" : value,
                  technician_rate_type: "unit",
                  technician_rate: "",
                }))}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="اختر الفني لتحديد مستحقاته" />
                </SelectTrigger>
                <SelectContent className="z-[9999]">
                  <SelectItem value="none">بدون فني حالياً (إدخال لاحق)</SelectItem>
                  {technicians?.filter(t => !editingItem || !editingItemTechnicians.some((et: any) => et.technician_id === t.id)).map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-orange-500" />
                        <span className="font-medium">{tech.name}</span>
                        {tech.specialty && <span className="text-xs text-muted-foreground">({tech.specialty})</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {inlineItem.technician_id && (
              <div className="bg-background/80 p-3.5 rounded-lg border border-border/80 space-y-3 animate-in fade-in slide-in-from-left-2">
                {/* Rate Type */}
                <div>
                  <Label className="text-xs font-semibold text-foreground mb-1 block">طريقة التسعير للفني</Label>
                  <Select
                    value={inlineItem.technician_rate_type}
                    onValueChange={(value: "unit" | "piece" | "fixed") => setInlineItem(prev => ({ 
                      ...prev, 
                      technician_rate_type: value, 
                      technician_rate: "", 
                      technician_piece_qty: "1" 
                    }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="unit">بالوحدة (حسب كمية البند)</SelectItem>
                      <SelectItem value="piece">بالقطعة / تكرار مخصص</SelectItem>
                      <SelectItem value="fixed">مبلغ مقطوع (ثابت)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Piece Qty if applicable */}
                  {inlineItem.technician_rate_type === "piece" && (
                    <div>
                      <Label className="text-xs font-semibold text-foreground mb-1 block">العدد (قطعة)</Label>
                      <Input
                        type="number"
                        value={inlineItem.technician_piece_qty}
                        onChange={(e) => setInlineItem(prev => ({ ...prev, technician_piece_qty: e.target.value }))}
                        placeholder="1"
                        className="h-9 text-sm"
                      />
                    </div>
                  )}
                  
                  {/* Rate Input */}
                  <div className={inlineItem.technician_rate_type === "piece" ? "" : "col-span-2"}>
                    <Label className="text-xs font-semibold text-foreground mb-1 block">
                      {inlineItem.technician_rate_type === "fixed" ? "المبلغ المقطوع" : inlineItem.technician_rate_type === "piece" ? "سعر القطعة" : "السعر لكل وحدة"}
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={inlineItem.technician_rate}
                        onChange={(e) => setInlineItem(prev => ({ ...prev, technician_rate: e.target.value }))}
                        placeholder="0.00"
                        className="h-9 text-sm pl-8 font-semibold"
                      />
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">د.ل</span>
                    </div>
                  </div>
                </div>

                {/* Live Technician Cost Preview */}
                <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-semibold">استحقاق الفني:</span>
                  {(() => {
                    const techRate = parseFloat(inlineItem.technician_rate) || 0;
                    const pieceQty = parseFloat(inlineItem.technician_piece_qty) || 1;
                    
                    let total = 0;
                    let formulaText = "";
                    if (inlineItem.technician_rate_type === "fixed") {
                      total = techRate;
                      formulaText = `${techRate.toLocaleString()} د.ل مقطوع`;
                    } else if (inlineItem.technician_rate_type === "piece") {
                      total = techRate * pieceQty;
                      formulaText = `${techRate.toLocaleString()} د.ل × ${pieceQty} قطعة`;
                    } else {
                      total = techRate * qty;
                      formulaText = `${techRate.toLocaleString()} د.ل × ${qty.toLocaleString(undefined, { maximumFractionDigits: 4 })} وحدة`;
                    }
                    
                    return (
                      <span className="font-bold text-orange-600 bg-orange-500/5 px-2 py-0.5 rounded border border-orange-500/10">
                        {formulaText} = {total.toLocaleString()} د.ل
                      </span>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* List of currently assigned technicians for Edit Mode */}
            {editingItem && editingItemTechnicians.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/80 space-y-2 max-h-[160px] overflow-y-auto pr-1">
                <Label className="text-xs font-semibold text-muted-foreground block mb-2">الفنيين المعينين حالياً ({editingItemTechnicians.length})</Label>
                <div className="space-y-1.5">
                  {editingItemTechnicians.map((et: any) => (
                    <div key={et.id} className="flex items-center justify-between bg-background border border-border rounded-lg p-2 text-xs">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{et.technicians?.name}</p>
                        <p className="text-[10px] text-muted-foreground font-medium">
                          {rateTypeLabels[et.rate_type || 'meter']} · {et.rate.toLocaleString()} د.ل
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-bold text-orange-600">{(et.total_cost || 0).toLocaleString()} د.ل</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 hover:bg-destructive/10 hover:text-destructive text-muted-foreground rounded-full cursor-pointer"
                          onClick={async () => {
                            const { error } = await supabase.from("project_item_technicians").delete().eq("id", et.id);
                            if (error) {
                              toast({ title: "خطأ", description: "حدث خطأ أثناء حذف الفني", variant: "destructive" });
                            } else {
                              setEditingItemTechnicians(prev => prev.filter((t: any) => t.id !== et.id));
                              queryClient.invalidateQueries({ queryKey: ["project-items", projectId] });
                              toast({ title: "تم الحذف", description: "تم إلغاء تعيين الفني بنجاح" });
                            }
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Info Note if no technician selected */}
          {!inlineItem.technician_id && (!editingItem || editingItemTechnicians.length === 0) && (
            <div className="bg-background/40 p-3 rounded-lg border border-border/60 text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5 font-medium">
              <Info className="h-4 w-4 text-[#d6ac40]" />
              <span>لم يتم تعيين أي فني لهذا البند حتى الآن.</span>
            </div>
          )}
        </div>
      </div>

      {/* Zone 4: Real-time profitability preview (Margin calculation) */}
      <div className="mt-6 pt-5 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Financial Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full md:w-auto md:flex-1 md:max-w-3xl">
          <div className="bg-background/80 border border-border/50 px-3.5 py-2 rounded-lg text-center md:text-right">
            <span className="text-[10px] text-muted-foreground font-semibold block">سعر البيع الإجمالي</span>
            <span className="text-base font-bold text-foreground">{saleTotal.toLocaleString()} د.ل</span>
          </div>
          
          <div className="bg-background/80 border border-border/50 px-3.5 py-2 rounded-lg text-center md:text-right">
            <span className="text-[10px] text-muted-foreground font-semibold block">تكلفة الفنيين الإجمالية</span>
            <span className="text-base font-bold text-orange-600">{totalCost.toLocaleString()} د.ل</span>
          </div>

          <div className={`border px-3.5 py-2 rounded-lg text-center md:text-right ${
            netProfit >= 0 
              ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-500' 
              : 'bg-destructive/5 border-destructive/20 text-destructive'
          }`}>
            <span className="text-[10px] text-muted-foreground font-semibold block">صافي الربح المتوقع</span>
            <span className="text-base font-bold flex items-center justify-center md:justify-start gap-1">
              {netProfit.toLocaleString()} د.ل
            </span>
          </div>

          <div className={`border px-3.5 py-2 rounded-lg text-center md:text-right ${
            profitMargin >= 20 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-500'
              : profitMargin >= 0 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-500'
                : 'bg-destructive/10 border-destructive/30 text-destructive'
          }`}>
            <span className="text-[10px] text-muted-foreground font-semibold block">هامش الربح (%)</span>
            <span className="text-base font-bold">{profitMargin.toFixed(1)}%</span>
          </div>
        </div>

        {/* Actions buttons */}
        <div className="flex gap-2 w-full md:w-auto shrink-0 justify-end">
          {editingItem && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleCancelEdit} 
              className="h-11 px-5 border-dashed cursor-pointer"
            >
              إلغاء التعديل
            </Button>
          )}
          <Button
            type="button"
            disabled={!inlineItem.name.trim() || saveMutation.isPending}
            onClick={async () => {
              if (!inlineItem.name.trim()) return;
              
              const finalQty = qty;
              const techId = inlineItem.technician_id;
              
              let detectedType: any = inlineItem.measurement_type;
              if (calculationMethod === "config" && inlineItem.measurement_config_id) {
                const mc = measurementConfigs?.find(c => c.id === inlineItem.measurement_config_id);
                detectedType = detectMeasurementType(mc || null);
              }

              saveMutation.mutate({
                name: inlineItem.name,
                description: inlineItem.description || null,
                measurement_type: detectedType,
                quantity: finalQty.toString(),
                unit_price: inlineItem.unit_price || "0",
                engineer_id: inlineItem.engineer_id || null,
                formula: "",
                length: "",
                width: "",
                height: "",
                notes: inlineItem.notes || null,
                measurement_factor: inlineItem.measurement_factor,
                measurement_config_id: inlineItem.measurement_config_id || null,
                component_values: inlineItem.component_values,
              }, {
                onSuccess: async (insertedItem: any) => {
                  const techRateType = inlineItem.technician_rate_type;
                  const techRate = parseFloat(inlineItem.technician_rate) || 0;
                  
                  let dbRateType = "meter";
                  let dbRate = techRate;
                  let dbQuantity = finalQty;
                  let dbTotalCost = 0;
                  
                  if (techRateType === "unit") {
                    dbRateType = "meter";
                    dbRate = techRate;
                    dbQuantity = finalQty;
                    dbTotalCost = techRate * finalQty;
                  } else if (techRateType === "piece") {
                    const pieceQty = parseFloat(inlineItem.technician_piece_qty) || 1;
                    dbRateType = "piece";
                    dbRate = techRate;
                    dbQuantity = pieceQty;
                    dbTotalCost = techRate * pieceQty;
                  } else if (techRateType === "fixed") {
                    dbRateType = "fixed";
                    dbRate = techRate;
                    dbQuantity = 1;
                    dbTotalCost = techRate;
                  }

                  if (editingItem && techId) {
                    const { data: existingTechs } = await supabase
                      .from("project_item_technicians")
                      .select("id, technician_id")
                      .eq("project_item_id", editingItem.id);
                    
                    const existingForTech = existingTechs?.find(t => t.technician_id === techId);
                    
                    if (!existingForTech) {
                      await supabase.from("project_item_technicians").insert({
                        project_item_id: editingItem.id,
                        technician_id: techId,
                        rate_type: dbRateType,
                        rate: dbRate,
                        quantity: dbQuantity,
                        total_cost: dbTotalCost,
                      });
                    }
                    queryClient.invalidateQueries({ queryKey: ["project-items", projectId] });
                  } else if (!editingItem && techId && insertedItem?.id) {
                    await supabase.from("project_item_technicians").insert({
                        project_item_id: insertedItem.id,
                        technician_id: techId,
                        rate_type: dbRateType,
                        rate: dbRate,
                        quantity: dbQuantity,
                        total_cost: dbTotalCost,
                    });
                    queryClient.invalidateQueries({ queryKey: ["project-items", projectId] });
                  }
                  setEditingItem(null);
                  setEditingItemTechnicians([]);
                  setCalculationMethod("manual");
                }
              });
              if (!editingItem) {
                setInlineItem({
                  generalItemId: "",
                  name: "",
                  description: "",
                  measurement_type: "linear",
                  quantity: "",
                  unit_price: "",
                  notes: "",
                  engineer_id: "",
                  technician_id: "",
                  technician_rate_type: "unit",
                  technician_rate: "",
                  technician_piece_qty: "1",
                  measurement_config_id: "",
                  component_values: {},
                  measurement_factor: "1",
                  item_count: "1",
                });
                setInlineSearch("");
                setCalculationMethod("manual");
                setTimeout(() => {
                  nameInputRef.current?.focus();
                }, 50);
              }
            }}
            className="h-11 px-6 gap-2 bg-[#d6ac40] hover:bg-[#b8860b] text-primary-foreground font-bold shadow-lg shadow-[#d6ac40]/25 transition-all cursor-pointer border-none"
          >
            {editingItem ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {saveMutation.isPending ? "جاري الحفظ..." : editingItem ? "تحديث البند الحالي" : "إضافة البند للفاتورة"}
          </Button>
        </div>
      </div>
    </div>
  );
};
