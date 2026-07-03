import { useState, useMemo, useEffect } from "react";
import { ProjectNavBar } from "@/components/layout/ProjectNavBar";
import { Checkbox } from "@/components/ui/checkbox";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  ShoppingCart,
  Coins,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Calendar,
  Save,
  X,
  FileText,
  Wrench,
  TrendingUp,
  TrendingDown,
  CreditCard,
  AlertTriangle,
  DollarSign,
  Printer,
  User,
  Building2,
  Download,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { formatCurrencyLYD } from "@/lib/currency";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Wallet, Landmark } from "lucide-react";
import { openPrintWindow, generatePrintStyles, getPrintValues } from "@/lib/printStyles";
import { format, parseISO } from "date-fns";
import { ar } from "date-fns/locale";
import html2pdf from "html2pdf.js";

interface Phase {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  order_index: number;
  status: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  treasury_id: string | null;
  reference_number: string | null;
  phase_number: number | null;
  has_percentage: boolean;
  percentage_value: number;
}

interface PhaseSummary {
  itemsCount: number;
  itemsTotal: number;
  purchasesCount: number;
  purchasesTotal: number;
  expensesCount: number;
  expensesTotal: number;
  techniciansCost: number;
  rentalsCount: number;
  rentalsTotal: number;
  clientPaid: number;
}

const imageUrlToBase64 = async (url: string): Promise<string> => {
  if (!url) return "";
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error converting image to base64:", error);
    return url;
  }
};

const ProjectPhases = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState<Phase | null>(null);
  const [deletePhaseId, setDeletePhaseId] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [bgBase64, setBgBase64] = useState<string>("");
  
  const [nameQuery, setNameQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "active",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    notes: "",
    treasury_id: "",
    has_percentage: false,
    percentage_value: "",
  });

  // Fetch project
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients(id, name)")
        .eq("id", projectId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Fetch client payments for the project
  const { data: projectPayments } = useQuery({
    queryKey: ["project-client-payments", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_payments")
        .select("amount")
        .eq("project_id", projectId!);
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Fetch phases
  const { data: phases, isLoading: phasesLoading } = useQuery({
    queryKey: ["project-phases", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_phases")
        .select("*")
        .eq("project_id", projectId!)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data as Phase[];
    },
    enabled: !!projectId,
  });

  // Fetch treasuries (all for grouping)
  const { data: allTreasuriesRaw } = useQuery({
    queryKey: ["treasuries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasuries")
        .select("id, name, parent_id, treasury_type, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; parent_id: string | null; treasury_type: string; is_active: boolean }[];
    },
  });
  // Only sub-treasuries (children) can be selected
  const parentTreasuries = allTreasuriesRaw?.filter(t => !t.parent_id) || [];
  const childTreasuries = allTreasuriesRaw?.filter(t => t.parent_id) || [];
  // For backward compat, also keep "treasuries" for display lookups
  const treasuries = allTreasuriesRaw;

  // Fetch all phase names for suggestions (from all projects)
  const { data: allPhaseNames } = useQuery({
    queryKey: ["all-phase-names"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_phases")
        .select("name")
        .order("name");
      if (error) throw error;
      // Unique names only
      const unique = [...new Set(data?.map((p) => p.name) || [])];
      return unique;
    },
  });

  // Built-in common construction phase suggestions
  const builtInSuggestions = [
    "أعمال الحفر والتأسيس",
    "الخرسانة المسلحة",
    "أعمال البناء والتشطيب",
    "الأعمال الكهربائية",
    "أعمال السباكة والصرف",
    "التشطيبات الداخلية",
    "التشطيبات الخارجية",
    "أعمال الألمنيوم والزجاج",
    "أعمال الدهانات",
    "أعمال السيراميك والرخام",
    "أعمال النجارة",
    "أعمال الحدادة",
    "أعمال العزل",
    "تنسيق الموقع العام",
    "أعمال التكييف والتبريد",
  ];

  // Merge and filter suggestions
  const filteredSuggestions = useMemo(() => {
    const allNames = [...new Set([...(allPhaseNames || []), ...builtInSuggestions])];
    const currentPhaseNames = phases?.map((p) => p.name.toLowerCase()) || [];
    const available = allNames.filter(
      (name) => !currentPhaseNames.includes(name.toLowerCase())
    );
    if (!nameQuery.trim()) return available.slice(0, 8);
    return available
      .filter((name) => name.toLowerCase().includes(nameQuery.toLowerCase()))
      .slice(0, 8);
  }, [allPhaseNames, nameQuery, phases]);

  // Fetch phase summaries - كل البيانات بطلب واحد لكل نوع (بدلاً من N+1 queries)
  const phaseIds = phases?.map(p => p.id) || [];
  const { data: phaseSummaries } = useQuery({
    queryKey: ["phase-summaries", projectId, phaseIds.join(",")],
    queryFn: async () => {
      if (!phases || phases.length === 0) return {};
      
      // جلب كل البيانات دفعة واحدة لكل المراحل بالتوازي
      const [
        { data: allItems },
        { data: allPurchases },
        { data: allExpenses },
        { data: allAllocations },
      ] = await Promise.all([
        supabase.from("project_items").select("phase_id, total_price, project_item_technicians(total_cost)").in("phase_id", phaseIds),
        supabase.from("purchases").select("phase_id, total_amount, rental_id").in("phase_id", phaseIds),
        supabase.from("expenses").select("phase_id, amount").in("phase_id", phaseIds),
        supabase.from("client_payment_allocations").select("phase_id, amount").in("phase_id", phaseIds),
      ]);

      const summaries: Record<string, PhaseSummary> = {};
      
      for (const phase of phases) {
        const items = allItems?.filter(i => i.phase_id === phase.id) || [];
        const purchases = allPurchases?.filter(p => p.phase_id === phase.id) || [];
        const expenses = allExpenses?.filter(e => e.phase_id === phase.id) || [];
        const allocations = allAllocations?.filter(a => a.phase_id === phase.id) || [];
        
        // المشتريات العادية (غير إيجارات)
        const normalPurchases = purchases.filter(p => !p.rental_id);
        // إيجارات المعدات فقط
        const rentalPurchases = purchases.filter(p => !!p.rental_id);
        const rentalsTotal = rentalPurchases.reduce((sum, rp) => sum + Number(rp.total_amount || 0), 0);
        
        const techniciansCost = items.reduce((sum, i: any) => {
          const itemTechCost = i.project_item_technicians?.reduce((s: number, t: any) => s + Number(t.total_cost || 0), 0) || 0;
          return sum + itemTechCost;
        }, 0);

        // المدفوع من الزبون = مجموع التخصيصات للمرحلة
        const clientPaid = allocations.reduce((sum, a) => sum + Number(a.amount || 0), 0);
        
        summaries[phase.id] = {
          itemsCount: items.length,
          itemsTotal: items.reduce((sum, i) => sum + Number(i.total_price || 0), 0),
          purchasesCount: normalPurchases.length,
          // إجمالي المشتريات = عادية + إيجارات (كلها تكلفة على الشركة)
          purchasesTotal: normalPurchases.reduce((sum, p) => sum + Number(p.total_amount || 0), 0),
          expensesCount: expenses.length,
          expensesTotal: expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
          techniciansCost,
          rentalsCount: rentalPurchases.length,
          rentalsTotal,
          clientPaid,
        };
      }
      
      return summaries;
    },
    enabled: !!phases && phases.length > 0,
  });

  // Fetch company settings for printing
  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Load background image as Base64 to bypass CORS in print window
  useEffect(() => {
    if (companySettings?.report_background) {
      imageUrlToBase64(companySettings.report_background).then(base64 => {
        setBgBase64(base64);
      });
    }
  }, [companySettings]);

  const companyPrintSettings = useMemo(() => {
    if (!companySettings) return null;
    if (!bgBase64) return companySettings;
    return {
      ...companySettings,
      report_background: bgBase64,
    };
  }, [companySettings, bgBase64]);

  const getMeasurementLabel = (type: string) => {
    switch (type) {
      case 'linear': return 'متر طولي';
      case 'square': case 'area': return 'متر مربع';
      case 'cubic': case 'volume': return 'متر مكعب';
      case 'count': return 'عدد';
      default: return type;
    }
  };

  const [printMenuPhase, setPrintMenuPhase] = useState<Phase | null>(null);
  const [clientPrintDialog, setClientPrintDialog] = useState<Phase | null>(null);
  const [clientPrintOptions, setClientPrintOptions] = useState({
    showPurchases: false,
    showRentals: false,
    showExpenses: false,
  });
  const [isPdfLoading, setIsPdfLoading] = useState<boolean>(false);

  const savePdfViaHtml2Pdf = async (html: string, filename: string) => {
    setIsPdfLoading(true);
    try {
      const v = getPrintValues(companyPrintSettings);
      const headHeight = v.padTop;
      const footHeight = v.padBottom;

      // Extract metadata if printHeaderEnabled
      let docTitle = "";
      let docSubtitle = "";
      let docMeta = "";
      if (v.printHeaderEnabled) {
        try {
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = html;
          docTitle = tempDiv.querySelector(".print-report-title")?.textContent?.trim() || "";
          docSubtitle = tempDiv.querySelector(".print-report-subtitle")?.textContent?.trim() || "";
          docMeta = tempDiv.querySelector(".print-report-meta")?.innerHTML?.trim() || "";
        } catch (err) {
          console.warn(err);
        }
      }

      const printHeaderHtml = v.printHeaderEnabled ? `
        <div class="unified-print-header" style="display: flex; justify-content: space-between; align-items: center; direction: rtl; width: 100%; font-family: '${v.printFontFamily}', 'Tajawal', 'Segoe UI', sans-serif;">
          <div style="display: flex; align-items: center; gap: 4mm;">
            ${v.companyLogo ? `<img src="${v.companyLogo}" style="height: 15mm; max-height: 18mm; object-fit: contain; vertical-align: middle;" />` : ''}
            <div style="text-align: right; vertical-align: middle;">
              <div style="font-size: 16pt; font-weight: 800; color: ${v.sectionTitleColor}; line-height: 1.2;">${v.companyName}</div>
              <div style="font-size: 8.5pt; color: #666; margin-top: 0.5mm;">منظومة إدارة المقاولات</div>
            </div>
          </div>
          
          <div style="text-align: left; font-size: 9.5pt; color: #333; line-height: 1.4; direction: ltr;">
            <div style="font-weight: bold; font-size: 11pt; color: ${v.sectionTitleColor}; direction: rtl;">${docTitle}</div>
            ${docSubtitle ? `<div style="font-size: 9pt; color: #444; direction: rtl; margin-top: 0.5mm;">${docSubtitle}</div>` : ''}
            ${docMeta ? `<div style="font-size: 8.5pt; color: #666; direction: rtl; margin-top: 0.5mm;">${docMeta}</div>` : ''}
          </div>
        </div>
      ` : '';

      const printWrapper = document.createElement("div");
      printWrapper.innerHTML = `
        <style>
          ${generatePrintStyles(companyPrintSettings)}
          .print-layout-table {
            width: 100%;
            border-collapse: collapse;
          }
          .print-layout-table thead {
            display: table-header-group !important;
          }
          .print-layout-table tfoot {
            display: table-footer-group !important;
          }
          .print-area {
            width: 100% !important;
            margin: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
            background-image: none !important;
            background-color: transparent !important;
          }
          .print-area::before {
            display: none !important;
          }
          .print-area .print-footer,
          .print-area .print-date {
            display: none !important;
          }
          /* Hide print-page-number from HTML layout of html2pdf to prevent "0 من 0" from rendering */
          .print-page-number {
            display: none !important;
          }
        </style>
        
        <table class="print-layout-table">
          <thead>
            <tr>
              <td>
                <div style="height: ${v.printHeaderEnabled ? 'auto' : `${headHeight}mm`}; ${v.printHeaderEnabled ? `padding: 10mm ${v.padRight}mm 4mm ${v.padLeft}mm; border-bottom: 2px solid ${v.sectionTitleColor}; margin-bottom: 5mm;` : ''}">
                  ${printHeaderHtml}
                </div>
              </td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 0 ${v.padRight}mm 0 ${v.padLeft}mm;">
                ${html}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>
                <div style="height: ${footHeight}mm;"></div>
              </td>
            </tr>
          </tfoot>
        </table>
      `;
      document.body.appendChild(printWrapper);
      
      const images = printWrapper.getElementsByTagName("img");
      await Promise.all(
        Array.from(images).map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(res => { img.onload = res; img.onerror = res; });
        })
      );
      await new Promise(r => setTimeout(r, 200));

      const opt = {
        margin: 0,
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css'] }
      };

      await html2pdf().set(opt).from(printWrapper).toPdf().get('pdf').then((pdf: any) => {
        const totalPages = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          
          // Draw a small white rectangle to mask the placeholder "صفحة 0 من 0" on the background
          pdf.setFillColor(255, 255, 255);
          // Coordinates: x = v.padLeft (e.g. 12mm), y = 297 - v.footerBottom - 4.5mm, width = 32mm, height = 7mm
          pdf.rect(v.padLeft, 297 - v.footerBottom - 4.5, 32, 7, 'F');
          
          pdf.setFontSize(9);
          pdf.setTextColor(85, 85, 85);
          // Draw page numbers "1 / 3" at the same spot
          pdf.text(i + " / " + totalPages, v.padLeft + 1, 297 - v.footerBottom);
        }
      }).save();
      document.body.removeChild(printWrapper);
      toast({ title: "تم حفظ الملف بنجاح" });
    } catch (error) {
      console.error("PDF export error:", error);
      toast({ title: "فشل حفظ الملف", variant: "destructive" });
    } finally {
      setIsPdfLoading(false);
    }
  };

  // Print phase handler
  const handlePrintPhase = async (phase: Phase, mode: 'client' | 'company', action: 'print' | 'pdf', options?: typeof clientPrintOptions) => {
    setPrintMenuPhase(null);
    setClientPrintDialog(null);
    const summary = phaseSummaries?.[phase.id];
    const isClient = mode === 'client';
    
    // Fetch detailed data for the phase
    const [{ data: items }, { data: purchases }, { data: expenses }, { data: rentalPurchases }, { data: allocations }] = await Promise.all([
      supabase.from("project_items").select("name, description, quantity, unit_price, total_price, measurement_type, length, width, height, measurement_factor, component_values, measurement_config_id, measurement_configs(name, unit_symbol), engineers(name), project_item_technicians(total_cost)").eq("phase_id", phase.id),
      supabase.from("purchases").select("*, suppliers(name)").eq("phase_id", phase.id).is("rental_id", null),
      supabase.from("expenses").select("*").eq("phase_id", phase.id),
      supabase.from("purchases").select("*, equipment_rentals(equipment(name), start_date, end_date, daily_rate)").eq("phase_id", phase.id).not("rental_id", "is", null),
      supabase.from("client_payment_allocations")
        .select(`
          amount,
          client_payments (
            date,
            payment_method,
            notes,
            treasuries (
              name
            )
          )
        `)
        .eq("phase_id", phase.id),
    ]);

    const totalItems = items?.reduce((sum, i) => sum + Number(i.total_price || 0), 0) || 0;
    const totalPurch = purchases?.reduce((sum, p) => sum + Number(p.total_amount || 0), 0) || 0;
    const totalRent = rentalPurchases?.reduce((sum, r) => sum + Number(r.total_amount || 0), 0) || 0;
    const totalExp = expenses?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;
    const totalTech = items?.reduce((sum, i: any) => {
      const itemTechCost = i.project_item_technicians?.reduce((s: number, t: any) => s + Number(t.total_cost || 0), 0) || 0;
      return sum + itemTechCost;
    }, 0) || 0;
    const clientPaidActual = allocations?.reduce((sum, a) => sum + Number(a.amount || 0), 0) || 0;

    const phasePercentage = phase.has_percentage && phase.percentage_value > 0 ? Number(phase.percentage_value) : 0;
    const totalPercentageFee = phasePercentage > 0 ? (totalPurch + totalRent) * phasePercentage / 100 : 0;
    const totalDueFromClient = totalItems + totalPurch + totalRent + totalPercentageFee;
    const clientRemaining = totalDueFromClient - clientPaidActual;

    const treasuryName = phase.treasury_id ? treasuries?.find(t => t.id === phase.treasury_id)?.name : "";
    const dateStr = format(new Date(), "yyyy/MM/dd", { locale: ar });

    // Build content using print template classes
    let sectionsHTML = '';

    // Header section
    sectionsHTML += `
      <div class="print-report-header">
        <div class="print-report-title">تقرير فاتورة المرحلة</div>
        <div class="print-report-subtitle">${project?.name || ""}</div>
        ${project?.clients?.name ? `<div class="print-report-meta">العميل: ${project.clients.name}</div>` : ""}
      </div>
    `;

    // Phase info table
    sectionsHTML += `
      <div class="print-section">
        <table class="print-info-table">
          <tr>
            <td class="info-label">المرحلة</td>
            <td class="info-value">${phase.name}</td>
            <td class="info-label">رقم الفاتورة</td>
            <td class="info-value">${phase.phase_number ? `#${phase.phase_number}` : '-'}</td>
          </tr>
          <tr>
            <td class="info-label">المرجع</td>
            <td class="info-value">${phase.reference_number || '-'}</td>
            ${mode === 'company' ? `<td class="info-label">الخزينة</td>
            <td class="info-value">${treasuryName || '-'}</td>` : `<td class="info-label"></td><td class="info-value"></td>`}
          </tr>
          ${phase.description ? `<tr><td class="info-label">الوصف</td><td class="info-value" colspan="3">${phase.description}</td></tr>` : ''}
        </table>
      </div>
    `;

    // 1. بنود المقاولات - تفصيلية
    if (items && items.length > 0) {
      const itemsTotal = items.reduce((s, i) => s + Number(i.total_price || 0), 0);

      // Prepare row data
      const processedItems = items.map((item: any, idx: number) => {
        const componentLabels: Record<string, string> = { L: 'الطول', W: 'العرض', H: 'الارتفاع', D: 'القطر', T: 'السُمك' };
        const cv = item.component_values as Record<string, number> | null;
        let dims = '-';
        if (cv && Object.keys(cv).length > 0) {
          dims = Object.entries(cv).map(([k, v]) => `${componentLabels[k] || k}:${v}`).join(' × ');
        } else {
          const parts = [
            item.length ? `الطول:${item.length}` : '',
            item.width ? `العرض:${item.width}` : '',
            item.height ? `الارتفاع:${item.height}` : '',
          ].filter(Boolean).join(' × ');
          if (parts) dims = parts;
        }

        return {
          idx: idx + 1,
          name: item.name || '',
          description: item.description || '-',
          unit: item.measurement_configs?.name || item.measurement_configs?.unit_symbol || getMeasurementLabel(item.measurement_type) || '-',
          dims: dims,
          factor: item.measurement_factor || '-',
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price
        };
      });

      // Check which columns are active
      const hasDescription = processedItems.some(r => r.description !== "-" && r.description !== "");
      const hasDims = processedItems.some(r => r.dims !== "-" && r.dims !== "");
      const hasFactor = processedItems.some(r => r.factor !== "-" && r.factor !== "" && r.factor !== 1 && r.factor !== "1");

      // Define columns dynamically
      const cols = [
        { header: "#", width: "5%", align: "center", render: (r: any) => `${r.idx}` },
        { header: "البند", width: hasDescription ? "20%" : "auto", align: "right", render: (r: any) => `${r.name}` },
        ...(hasDescription ? [{ header: "الوصف", width: "auto", align: "right", render: (r: any) => `${r.description}` }] : []),
        { header: "نوع القياس", width: "10%", align: "center", render: (r: any) => `${r.unit}` },
        ...(hasDims ? [{ header: "الأبعاد", width: "16%", align: "center", render: (r: any) => `${r.dims}` }] : []),
        ...(hasFactor ? [{ header: "عدد العناصر", width: "10%", align: "center", render: (r: any) => `${r.factor}` }] : []),
        { header: "الكمية", width: "10%", align: "center", render: (r: any) => `${r.quantity}` },
        { header: "سعر الوحدة", width: "12%", align: "center", render: (r: any) => `${formatCurrencyLYD(r.unit_price)}` },
        { header: "الإجمالي", width: "12%", align: "center", render: (r: any) => `<span style="font-weight: bold;">${formatCurrencyLYD(r.total_price)}</span>` }
      ];

      sectionsHTML += `
        <div class="print-section">
          <div class="print-section-title">فاتورة بنود المقاولات</div>
          <table class="print-table">
            <thead>
              <tr>
                ${cols.map(c => `<th style="width: ${c.width}; text-align: ${c.align === 'right' ? 'right' : 'center'};">${c.header}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${processedItems.map(r => `
                <tr>
                  ${cols.map(c => `<td style="text-align: ${c.align === 'right' ? 'right' : 'center'};">${c.render(r)}</td>`).join("")}
                </tr>
              `).join("")}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="${cols.length - 1}">الإجمالي</td>
                <td style="font-weight: bold; text-align: center;">${formatCurrencyLYD(itemsTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }

    // 2. فواتير الخدمات والمشتريات
    if ((!isClient || options?.showPurchases) && purchases && purchases.length > 0) {
      const purchasesTotal = purchases.reduce((s, p) => s + Number(p.total_amount || 0), 0);
      
      const processedPurchases = purchases.map((p: any, idx: number) => {
        return {
          idx: idx + 1,
          supplier: p.suppliers?.name || "-",
          invoiceNum: p.invoice_number || "-",
          date: format(parseISO(p.date), "yyyy/MM/dd", { locale: ar }),
          notes: p.notes || "-",
          amount: p.total_amount
        };
      });

      const hasSupplier = processedPurchases.some(r => r.supplier !== "-" && r.supplier !== "");
      const hasInvoiceNum = processedPurchases.some(r => r.invoiceNum !== "-" && r.invoiceNum !== "");
      const hasNotes = processedPurchases.some(r => r.notes !== "-" && r.notes !== "");

      const cols = [
        { header: "#", width: "6%", align: "center", render: (r: any) => `${r.idx}` },
        ...(hasSupplier ? [{ header: "المورد", width: hasNotes ? "20%" : "auto", align: "right", render: (r: any) => `${r.supplier}` }] : []),
        ...(hasInvoiceNum ? [{ header: "رقم الفاتورة", width: "15%", align: "center", render: (r: any) => `${r.invoiceNum}` }] : []),
        { header: "التاريخ", width: "18%", align: "center", render: (r: any) => `${r.date}` },
        ...(hasNotes ? [{ header: "الملاحظات", width: "auto", align: "right", render: (r: any) => `${r.notes}` }] : []),
        { header: "المبلغ", width: "18%", align: "center", render: (r: any) => `<span style="font-weight: bold;">${formatCurrencyLYD(r.amount)}</span>` }
      ];

      sectionsHTML += `
        <div class="print-section">
          <div class="print-section-title">فواتير الخدمات والمشتريات</div>
          <table class="print-table">
            <thead>
              <tr>
                ${cols.map(c => `<th style="width: ${c.width}; text-align: ${c.align === 'right' ? 'right' : 'center'};">${c.header}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${processedPurchases.map(r => `
                <tr>
                  ${cols.map(c => `<td style="text-align: ${c.align === 'right' ? 'right' : 'center'};">${c.render(r)}</td>`).join("")}
                </tr>
              `).join("")}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="${cols.length - 1}">الإجمالي</td>
                <td style="font-weight: bold; text-align: center;">${formatCurrencyLYD(purchasesTotal)}</td>
              </tr>
              ${phase.has_percentage && phase.percentage_value ? `
              <tr>
                <td colspan="${cols.length - 1}">النسبة المستحقة (${phase.percentage_value}%)</td>
                <td style="font-weight: bold; text-align: center;">${formatCurrencyLYD(purchasesTotal * Number(phase.percentage_value) / 100)}</td>
              </tr>
              <tr>
                <td colspan="${cols.length - 1}" style="font-weight: bold;">المستحق على الزبون</td>
                <td style="font-weight: bold; text-align: center;">${formatCurrencyLYD(purchasesTotal + (purchasesTotal * Number(phase.percentage_value) / 100))}</td>
              </tr>
              ` : ''}
            </tfoot>
          </table>
        </div>
      `;
    }

    // 3. إيجارات المعدات
    if ((!isClient || options?.showRentals) && rentalPurchases && rentalPurchases.length > 0) {
      const rentalsTotal = rentalPurchases.reduce((s, r) => s + Number(r.total_amount || 0), 0);
      sectionsHTML += `
        <div class="print-section">
          <div class="print-section-title">إيجارات المعدات</div>
          <table class="print-table">
            <thead>
              <tr>
                <th style="width: 5%; text-align: center;">#</th>
                <th style="width: 55%;">المعدة</th>
                <th style="width: 20%; text-align: center;">التاريخ</th>
                <th style="width: 20%; text-align: center;">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              ${rentalPurchases.map((r: any, idx: number) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${r.equipment_rentals?.equipment?.name || "-"}</td>
                  <td>${format(parseISO(r.date), "yyyy/MM/dd", { locale: ar })}</td>
                  <td style="font-weight: bold;">${formatCurrencyLYD(r.total_amount)}</td>
                </tr>
              `).join("")}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3">الإجمالي</td>
                <td>${formatCurrencyLYD(rentalsTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }

    // 4. المصروفات
    if ((!isClient || options?.showExpenses) && expenses && expenses.length > 0) {
      const expensesTotal = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
      sectionsHTML += `
        <div class="print-section">
          <div class="print-section-title">المصروفات</div>
          <table class="print-table">
            <thead>
              <tr>
                <th style="width: 5%; text-align: center;">#</th>
                <th style="width: 55%;">الوصف</th>
                <th style="width: 20%; text-align: center;">التاريخ</th>
                <th style="width: 20%; text-align: center;">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              ${expenses.map((e: any, idx: number) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${e.description}</td>
                  <td>${format(parseISO(e.date), "yyyy/MM/dd", { locale: ar })}</td>
                  <td style="font-weight: bold;">${formatCurrencyLYD(e.amount)}</td>
                </tr>
              `).join("")}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3">الإجمالي</td>
                <td>${formatCurrencyLYD(expensesTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }

    // 5. مدفوعات الزبون
    if (allocations && allocations.length > 0) {
      // Prepare data rows
      const paymentRows = allocations.map((a: any, idx: number) => {
        const p = a.client_payments;
        const payDate = p?.date ? format(parseISO(p.date), "yyyy/MM/dd", { locale: ar }) : "-";
        let payMethod = p?.payment_method || "-";
        if (payMethod === 'cash') payMethod = 'نقداً';
        else if (payMethod === 'bank') payMethod = 'تحويل مصرفي';
        else if (payMethod === 'check') payMethod = 'صك';
        
        const treasury = p?.treasuries?.name || "-";
        const notes = p?.notes || "-";
        return {
          idx: idx + 1,
          date: payDate,
          method: payMethod,
          treasury: treasury,
          notes: notes,
          amount: a.amount
        };
      });

      // Check if notes column is empty for all rows
      const hasNotes = paymentRows.some(r => r.notes !== "-" && r.notes !== "");
      // Check if treasury column is empty for all rows
      const hasTreasury = paymentRows.some(r => r.treasury !== "-" && r.treasury !== "");
      // Check if method column is empty for all rows
      const hasMethod = paymentRows.some(r => r.method !== "-" && r.method !== "");
      // Check if date column is empty for all rows
      const hasDate = paymentRows.some(r => r.date !== "-" && r.date !== "");

      // Define columns to render based on emptiness
      const cols = [
        { header: "#", width: "6%", align: "center", render: (r: any) => `${r.idx}` },
        ...(hasDate ? [{ header: "التاريخ", width: "16%", align: "center", render: (r: any) => `${r.date}` }] : []),
        ...(hasMethod ? [{ header: "طريقة الدفع", width: "16%", align: "center", render: (r: any) => `${r.method}` }] : []),
        ...(hasTreasury ? [{ header: "الخزينة", width: hasNotes ? "18%" : "auto", align: "center", render: (r: any) => `${r.treasury}` }] : []),
        ...(hasNotes ? [{ header: "الملاحظات", width: "auto", align: "right", render: (r: any) => `${r.notes}` }] : []),
        { header: "المبلغ", width: "18%", align: "center", render: (r: any) => `<span style="font-weight: bold;">${formatCurrencyLYD(r.amount)}</span>` }
      ];

      sectionsHTML += `
        <div class="print-section">
          <div class="print-section-title">مدفوعات الزبون المسددة للمرحلة</div>
          <table class="print-table">
            <thead>
              <tr>
                ${cols.map(c => `<th style="width: ${c.width}; text-align: ${c.align === 'right' ? 'right' : 'center'};">${c.header}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${paymentRows.map(r => `
                <tr>
                  ${cols.map(c => `<td style="text-align: ${c.align === 'right' ? 'right' : 'center'};">${c.render(r)}</td>`).join("")}
                </tr>
              `).join("")}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="${cols.length - 1}">إجمالي المدفوعات المسددة</td>
                <td style="font-weight: bold; text-align: center;">${formatCurrencyLYD(clientPaidActual)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }

    // ملخص مالي
    // We already computed these values at the top of the function:
    // totalItems, clientPaidActual, totalPurch, totalRent, totalExp, totalTech, totalPercentageFee, totalDueFromClient, clientRemaining

    if (isClient) {
      // للزبون: إجمالي البنود + الأقسام المختارة
      let clientSummaryHTML = `
        <div class="print-section">
          <div class="print-section-title">الملخص المالي</div>
          <table class="print-summary-table">
            <thead><tr><th>البيان</th><th>المبلغ</th></tr></thead>
            <tbody>
              <tr><td>إجمالي بنود المقاولات</td><td>${formatCurrencyLYD(totalItems)}</td></tr>
      `;
      let clientTotal = totalItems;
      let percentageFeeTotal = 0;
      if (options?.showPurchases) {
        clientSummaryHTML += `<tr><td>إجمالي المشتريات</td><td>${formatCurrencyLYD(totalPurch)}</td></tr>`;
        clientTotal += totalPurch;
        if (phase.has_percentage && phase.percentage_value > 0) {
          const fee = totalPurch * Number(phase.percentage_value) / 100;
          percentageFeeTotal += fee;
        }
      }
      if (options?.showRentals) {
        clientSummaryHTML += `<tr><td>إجمالي إيجارات المعدات</td><td>${formatCurrencyLYD(totalRent)}</td></tr>`;
        clientTotal += totalRent;
        if (phase.has_percentage && phase.percentage_value > 0) {
          const fee = totalRent * Number(phase.percentage_value) / 100;
          percentageFeeTotal += fee;
        }
      }
      if (options?.showExpenses) {
        clientSummaryHTML += `<tr><td>إجمالي المصروفات</td><td>${formatCurrencyLYD(totalExp)}</td></tr>`;
        clientTotal += totalExp;
      }
      if (percentageFeeTotal > 0) {
        clientSummaryHTML += `<tr><td>النسبة المستحقة (${phase.percentage_value}%)</td><td>${formatCurrencyLYD(percentageFeeTotal)}</td></tr>`;
        clientTotal += percentageFeeTotal;
      }
      // المدفوع والمتبقي
      clientSummaryHTML += `
        <tr style="background-color: #e8f5e9;"><td>المدفوع من الزبون</td><td style="color: #1a5f1a; font-weight: bold;">${formatCurrencyLYD(clientPaidActual)}</td></tr>
        <tr style="background-color: ${clientRemaining > 0 ? '#ffebee' : '#e8f5e9'};"><td>المتبقي على الزبون</td><td style="color: ${clientRemaining > 0 ? '#b91c1c' : '#1a5f1a'}; font-weight: bold;">${formatCurrencyLYD(clientRemaining)}</td></tr>
      `;
      if (options?.showPurchases || options?.showRentals || options?.showExpenses) {
        clientSummaryHTML += `</tbody><tfoot><tr><td>الإجمالي الكلي</td><td>${formatCurrencyLYD(clientTotal)}</td></tr></tfoot>`;
      } else {
        clientSummaryHTML += `</tbody>`;
      }
      clientSummaryHTML += `</table></div>`;
      sectionsHTML += clientSummaryHTML;
    } else {
      // للشركة: ملخص مالي كامل
      const percentageFee = phase.has_percentage && phase.percentage_value > 0 
        ? (totalPurch + totalRent) * Number(phase.percentage_value) / 100 
        : 0;
      const totalCosts = totalPurch + totalExp + totalTech + totalRent;
      const netProfit = clientPaidActual - totalCosts;

      sectionsHTML += `
        <div class="print-section">
          <div class="print-section-title">الملخص المالي</div>
          <table class="print-summary-table">
            <thead>
              <tr>
                <th>البيان</th>
                <th>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>إجمالي بنود المقاولات</td><td>${formatCurrencyLYD(totalItems)}</td></tr>
              <tr><td>إجمالي المشتريات</td><td>${formatCurrencyLYD(totalPurch)}</td></tr>
              ${percentageFee > 0 ? `<tr><td>النسبة المستحقة من المشتريات (${phase.percentage_value}%)</td><td>${formatCurrencyLYD(percentageFee)}</td></tr>` : ''}
              <tr><td>إجمالي إيجارات المعدات</td><td>${formatCurrencyLYD(totalRent)}</td></tr>
              <tr><td>إجمالي المصروفات</td><td>${formatCurrencyLYD(totalExp)}</td></tr>
              <tr><td>تكاليف العمالة</td><td>${formatCurrencyLYD(totalTech)}</td></tr>
              <tr style="background-color: #e8f5e9;"><td>المدفوع من الزبون</td><td style="color: #1a5f1a; font-weight: bold;">${formatCurrencyLYD(clientPaidActual)}</td></tr>
              <tr style="background-color: ${clientRemaining > 0 ? '#ffebee' : '#e8f5e9'};"><td>المتبقي على الزبون</td><td style="color: ${clientRemaining > 0 ? '#b91c1c' : '#1a5f1a'}; font-weight: bold;">${formatCurrencyLYD(clientRemaining)}</td></tr>
            </tbody>
            <tfoot>
              <tr>
                <td>إجمالي التكاليف</td>
                <td>${formatCurrencyLYD(totalCosts)}</td>
              </tr>
              <tr>
                <td>صافي الربح</td>
                <td style="color: ${netProfit >= 0 ? '#1a5f1a' : '#b91c1c'}; font-weight: bold;">${formatCurrencyLYD(netProfit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }

    // Wrap in print-area template
    const fullContent = `
      <div class="print-area">
        <div class="print-content">
          ${sectionsHTML}
        </div>
        <div class="print-footer">
          <span>${project?.name || ""} - ${phase.name}</span>
          <span class="print-date">تاريخ الطباعة: ${dateStr}</span>
        </div>
      </div>
    `;

    const title = `تقرير مرحلة ${isClient ? '(زبون)' : '(شركة)'} - ${phase.name} - ${project?.name || ""}`;
    const cleanClientName = (project?.clients as any)?.name ? `_${(project.clients as any).name}` : "";
    const cleanPhaseName = phase.name.replace(/\s+/g, "_");
    const filename = `تقرير_مرحلة_${isClient ? 'زبون' : 'شركة'}_${cleanPhaseName}${cleanClientName}_${format(new Date(), "dd-MM-yyyy")}.pdf`;

    if (action === 'print') {
      openPrintWindow(title, fullContent, companyPrintSettings);
    } else {
      await savePdfViaHtml2Pdf(fullContent, filename);
    }
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        project_id: projectId!,
        name: data.name,
        description: data.description || null,
        status: data.status,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        notes: data.notes || null,
        order_index: editingPhase?.order_index ?? (phases?.length || 0),
        treasury_id: data.treasury_id || null,
        has_percentage: data.has_percentage,
        percentage_value: data.has_percentage ? (parseFloat(data.percentage_value) || 0) : 0,
      };

      if (editingPhase) {
        const { error } = await supabase
          .from("project_phases")
          .update(payload)
          .eq("id", editingPhase.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("project_phases").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-phases", projectId] });
      toast({
        title: editingPhase ? "تم تحديث فاتورة المرحلة" : "تم إضافة فاتورة المرحلة",
      });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حفظ فاتورة المرحلة",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (phaseId: string) => {
      const { error } = await supabase
        .from("project_phases")
        .delete()
        .eq("id", phaseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-phases", projectId] });
      toast({ title: "تم حذف فاتورة المرحلة" });
      setDeletePhaseId(null);
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حذف فاتورة المرحلة",
        variant: "destructive",
      });
    },
  });

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPhase(null);
    setNameQuery("");
    setShowSuggestions(false);
    
    setFormData({
      name: "",
      description: "",
      status: "active",
      start_date: new Date().toISOString().split("T")[0],
      end_date: "",
      notes: "",
      treasury_id: "",
      has_percentage: false,
      percentage_value: "",
    });
  };

  const handleEdit = (phase: Phase) => {
    setEditingPhase(phase);
    setFormData({
      name: phase.name,
      description: phase.description || "",
      status: phase.status,
      start_date: phase.start_date || "",
      end_date: phase.end_date || "",
      notes: phase.notes || "",
      treasury_id: phase.treasury_id || "",
      has_percentage: phase.has_percentage || false,
      percentage_value: phase.percentage_value ? String(phase.percentage_value) : "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال اسم فاتورة المرحلة",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate(formData);
  };

  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(phaseId)) {
        newSet.delete(phaseId);
      } else {
        newSet.add(phaseId);
      }
      return newSet;
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default">نشط</Badge>;
      case "completed":
        return <Badge variant="secondary">مكتمل</Badge>;
      case "pending":
        return <Badge variant="outline">قيد الانتظار</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (projectLoading || phasesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">المشروع غير موجود</p>
        <Link to="/projects">
          <Button variant="link">العودة للمشاريع</Button>
        </Link>
      </div>
    );
  }

  const allSummaries = phaseSummaries ? Object.values(phaseSummaries) : [];
  const totalClientPaid = projectPayments?.reduce((s, p) => s + Number(p.amount || 0), 0) || 0;
  const totalAllocated = allSummaries.reduce((s, x) => s + (x.clientPaid || 0), 0);
  const unallocatedAmount = Math.max(0, totalClientPaid - totalAllocated);

  return (
    <div className="space-y-6" dir="rtl">
      <ProjectNavBar />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Layers className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">فواتير مراحل المشروع</h1>
            <p className="text-sm text-muted-foreground">
              {project.name} - {project.clients?.name || "بدون عميل"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate(`/projects/${projectId}/payments`)}>
            <CreditCard className="h-4 w-4 ml-2" />
            تسديدات الزبون
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 ml-2" />
            إضافة فاتورة مرحلة
          </Button>
        </div>
      </div>

      {unallocatedAmount > 0 && phases && phases.length > 1 && (
        <Alert className="border-yellow-500/50 bg-yellow-500/10">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertDescription className="text-yellow-700 dark:text-yellow-300 font-medium">
            توجد مدفوعات غير مخصصة للمراحل بقيمة {formatCurrencyLYD(unallocatedAmount)}. يمكنك تخصيصها للمراحل من صفحة {" "}
            <Link to={`/projects/${projectId}/payments`} className="underline font-bold">تسديدات الزبون</Link>.
          </AlertDescription>
        </Alert>
      )}

      {/* ملخص مالي شامل لكل المراحل */}
      {phaseSummaries && Object.keys(phaseSummaries).length > 0 && (
        (() => {
          const totalItems = allSummaries.reduce((s, x) => s + (x.itemsTotal || 0), 0);
          const totalPurchases = allSummaries.reduce((s, x) => s + (x.purchasesTotal || 0), 0);
          const totalExpenses = allSummaries.reduce((s, x) => s + (x.expensesTotal || 0), 0);
          const totalLabor = allSummaries.reduce((s, x) => s + (x.techniciansCost || 0), 0);
          const totalRentals = allSummaries.reduce((s, x) => s + (x.rentalsTotal || 0), 0);
          // إجمالي تكاليف الشركة
          const totalCosts = totalPurchases + totalExpenses + totalLabor + totalRentals;
          // إجمالي إيرادات الشركة المتوقعة = بنود المقاولات (عقد مع العميل)
          // صافي الربح المتوقع = إيرادات - تكاليف
          const expectedProfit = totalItems - totalCosts;
          // الربح الفعلي المحقق = ما دفعه الزبون فعلاً - التكاليف
          const realizedProfit = totalClientPaid - totalCosts;
          
          const budget = Number(project.budget) || 0;
          const isOverBudget = budget > 0 && totalCosts > budget;
          const usagePercent = budget > 0 ? Math.min((totalCosts / budget) * 100, 100) : 0;
          
          return (
            <Card className="border border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <h3 className="font-bold text-base">الملخص المالي الشامل للمشروع</h3>
                  {budget > 0 && (
                    <Badge variant={isOverBudget ? "destructive" : "secondary"} className="mr-auto">
                      {isOverBudget ? `تجاوز الميزانية بـ ${formatCurrencyLYD(totalCosts - budget)}` : `${usagePercent.toFixed(0)}% من الميزانية`}
                    </Badge>
                  )}
                </div>
                
                {/* شريط التقدم */}
                {budget > 0 && (
                  <div className="w-full h-2 bg-muted rounded-full mb-4 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${isOverBudget ? 'bg-destructive' : usagePercent > 80 ? 'bg-yellow-500' : 'bg-primary'}`}
                      style={{ width: `${Math.min(usagePercent, 100)}%` }}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-sm">
                  <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-xs text-muted-foreground">بنود المقاولات</p>
                    <p className="font-bold text-primary">{formatCurrencyLYD(totalItems)}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground">المشتريات</p>
                    <p className="font-bold">{formatCurrencyLYD(totalPurchases)}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground">المصروفات</p>
                    <p className="font-bold">{formatCurrencyLYD(totalExpenses)}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground">العمالة</p>
                    <p className="font-bold">{formatCurrencyLYD(totalLabor)}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground">الإيجارات</p>
                    <p className="font-bold">{formatCurrencyLYD(totalRentals)}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-green-500/5 border border-green-500/20">
                    <p className="text-xs text-muted-foreground">تسديد الزبون</p>
                    <p className="font-bold text-green-600">{formatCurrencyLYD(totalClientPaid)}</p>
                    {unallocatedAmount > 0 && (
                      <p className="text-[10px] text-yellow-600 dark:text-yellow-400 mt-0.5 font-medium">
                        غير مخصص: {formatCurrencyLYD(unallocatedAmount)}
                      </p>
                    )}
                  </div>
                  <div className={`p-2.5 rounded-lg border ${expectedProfit >= 0 ? 'bg-green-500/5 border-green-500/20' : 'bg-destructive/5 border-destructive/20'}`}>
                    <p className="text-xs text-muted-foreground">صافي الربح</p>
                    <p className={`font-bold ${expectedProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>{formatCurrencyLYD(expectedProfit)}</p>
                    {totalClientPaid > 0 && (
                      <p className={`text-xs ${realizedProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        محقق: {formatCurrencyLYD(realizedProfit)}
                      </p>
                    )}
                  </div>
                </div>

                {isOverBudget && (
                  <Alert className="mt-3 border-destructive/50 bg-destructive/10">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <AlertDescription className="text-destructive font-medium">
                      التكاليف الكلية تجاوزت الميزانية المحددة بمبلغ {formatCurrencyLYD(totalCosts - budget)}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          );
        })()
      )}

      {/* Phases */}
      <div className="space-y-4">
        {phases?.length === 0 ? (
          <Card className="p-12 text-center">
            <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">لا توجد فواتير مراحل</h3>
            <p className="text-muted-foreground mb-4">
              ابدأ بإضافة فاتورة مرحلة جديدة للمشروع
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 ml-2" />
              إضافة فاتورة مرحلة
            </Button>
          </Card>
        ) : (
          phases?.map((phase) => {
            const summary = phaseSummaries?.[phase.id];
            const isExpanded = expandedPhases.has(phase.id);
            
            return (
              <Collapsible
                key={phase.id}
                open={isExpanded}
                onOpenChange={() => togglePhase(phase.id)}
              >
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between p-4">
                    {/* Clickable trigger area */}
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center gap-3 flex-1 cursor-pointer">
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div className="text-right flex-1">
                          <div className="flex items-center gap-3 w-full">
                            {phase.phase_number && (
                              <Badge variant="outline" className="text-sm font-bold px-3 py-1">فاتورة #{phase.phase_number}</Badge>
                            )}
                            {phase.reference_number && (
                              <Badge variant="secondary" className="text-sm font-mono font-bold px-3 py-1">{phase.reference_number}</Badge>
                            )}
                            <h3 className="font-semibold">{phase.name}</h3>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {phase.description && (
                              <p className="text-sm text-muted-foreground">
                                {phase.description}
                              </p>
                            )}
                            {phase.treasury_id && treasuries && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Wallet className="h-3 w-3" />
                                {treasuries.find(t => t.id === phase.treasury_id)?.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(phase.status)}
                      <div className="flex gap-1">
                        <div className="relative">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); setPrintMenuPhase(printMenuPhase?.id === phase.id ? null : phase); }}
                            title="طباعة تقرير المرحلة"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                           {printMenuPhase?.id === phase.id && (
                            <div className="absolute top-full left-0 z-50 mt-1 bg-popover border border-border rounded-lg shadow-lg min-w-[180px] p-1 space-y-1">
                              <button
                                className="w-full text-right px-3 py-2 text-sm rounded hover:bg-accent transition-colors flex items-center gap-2"
                                onClick={() => {
                                  setPrintMenuPhase(null);
                                  setClientPrintOptions({ showPurchases: false, showRentals: false, showExpenses: false });
                                  setClientPrintDialog(phase);
                                }}
                              >
                                <User className="h-4 w-4 text-muted-foreground" />
                                تقرير الزبون (خيارات...)
                              </button>
                              <div className="h-px bg-border my-1" />
                              <button
                                className="w-full text-right px-3 py-2 text-sm rounded hover:bg-accent transition-colors flex items-center gap-2"
                                onClick={() => {
                                  setPrintMenuPhase(null);
                                  handlePrintPhase(phase, 'company', 'print');
                                }}
                              >
                                <Printer className="h-4 w-4 text-muted-foreground" />
                                طباعة للشركة
                              </button>
                              <button
                                className="w-full text-right px-3 py-2 text-sm rounded hover:bg-accent transition-colors flex items-center gap-2"
                                onClick={() => {
                                  setPrintMenuPhase(null);
                                  handlePrintPhase(phase, 'company', 'pdf');
                                }}
                              >
                                <Download className="h-4 w-4 text-muted-foreground" />
                                تحميل PDF للشركة
                              </button>
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); handleEdit(phase); }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); setDeletePhaseId(phase.id); }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      {/* Summary Cards */}
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 mb-4">
                        {/* فاتورة بنود المقاولات */}
                        <Card className="bg-primary/5 border-primary/20">
                          <CardContent className="p-3">
                            <div className="flex items-center gap-2.5">
                              <div className="p-1.5 bg-primary/10 rounded-md">
                                <Package className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">بنود المقاولات</p>
                                <p className="text-sm font-bold">{summary?.itemsCount || 0}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatCurrencyLYD(summary?.itemsTotal || 0)}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        
                        {/* فواتير الخدمات والمشتريات */}
                        <Card className="bg-primary/5 border-primary/20">
                          <CardContent className="p-3">
                            <div className="flex items-center gap-2.5">
                              <div className="p-1.5 bg-primary/10 rounded-md">
                                <ShoppingCart className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">المشتريات</p>
                                <p className="text-sm font-bold">{summary?.purchasesCount || 0}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatCurrencyLYD(summary?.purchasesTotal || 0)}
                                </p>
                                {phase.has_percentage && phase.percentage_value > 0 && (
                                  <>
                                    <p className="text-xs text-primary font-medium">
                                      النسبة: {formatCurrencyLYD((summary?.purchasesTotal || 0) * phase.percentage_value / 100)} ({phase.percentage_value}%)
                                    </p>
                                    <p className="text-xs text-primary font-bold">
                                      المستحق: {formatCurrencyLYD((summary?.purchasesTotal || 0) + (summary?.purchasesTotal || 0) * phase.percentage_value / 100)}
                                    </p>
                                  </>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* إيجارات المعدات */}
                        <Card className="bg-primary/5 border-primary/20">
                          <CardContent className="p-3">
                            <div className="flex items-center gap-2.5">
                              <div className="p-1.5 bg-primary/10 rounded-md">
                                <Wrench className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">إيجارات المعدات</p>
                                <p className="text-sm font-bold">{summary?.rentalsCount || 0}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatCurrencyLYD(summary?.rentalsTotal || 0)}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* تكاليف العمالة */}
                        <Card className="bg-primary/5 border-primary/20">
                          <CardContent className="p-3">
                            <div className="flex items-center gap-2.5">
                              <div className="p-1.5 bg-primary/10 rounded-md">
                                <Layers className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">تكاليف العمالة</p>
                                <p className="text-sm font-bold">
                                  {formatCurrencyLYD(summary?.techniciansCost || 0)}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        
                        {/* المصروفات */}
                        <Card className="bg-primary/5 border-primary/20">
                          <CardContent className="p-3">
                            <div className="flex items-center gap-2.5">
                              <div className="p-1.5 bg-primary/10 rounded-md">
                                <Coins className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">المصروفات</p>
                                <p className="text-sm font-bold">{summary?.expensesCount || 0}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatCurrencyLYD(summary?.expensesTotal || 0)}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* المدفوع من الزبون والمتبقي */}
                        {(() => {
                          // ما دفعه الزبون فعلاً من خلال تخصيصات الدفع
                          // إذا كان المشروع يحتوي على مرحلة واحدة فقط، نعتبر إجمالي مدفوعات المشروع مدفوعة لهذه المرحلة
                          const clientPaid = phases?.length === 1
                            ? totalClientPaid
                            : (summary?.clientPaid || 0);
                          const itemsTotal = summary?.itemsTotal || 0;
                          const pct = phase.has_percentage && phase.percentage_value > 0 ? Number(phase.percentage_value) : 0;
                          const purchTotal = summary?.purchasesTotal || 0;
                          // إجمالي المستحق على الزبون = بنود المقاولات + مشتريات + نسبة الشركة على المشتريات
                          const totalDue = itemsTotal + purchTotal * (1 + pct / 100);
                          const remaining = totalDue - clientPaid;
                          return (
                            <Card className="border bg-muted/30">
                              <CardContent className="p-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="p-1.5 rounded-md bg-primary/10">
                                    <CreditCard className="h-4 w-4 text-primary" />
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">المدفوع من الزبون</p>
                                    <p className="text-sm font-bold text-green-600">{formatCurrencyLYD(clientPaid)}</p>
                                    <p className="text-xs text-muted-foreground">المستحق: {formatCurrencyLYD(totalDue)}</p>
                                    <p className={`text-xs font-medium ${remaining > 0 ? 'text-destructive' : 'text-green-600'}`}>
                                      المتبقي: {formatCurrencyLYD(Math.abs(remaining))}{remaining <= 0 ? ' ✓' : ''}
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })()}

                        {/* صافي الربح المتوقع */}
                        {(() => {
                          // التكاليف الفعلية على الشركة
                          const totalCosts = (summary?.purchasesTotal || 0) + (summary?.expensesTotal || 0) + (summary?.techniciansCost || 0) + (summary?.rentalsTotal || 0);
                          // إيرادات المرحلة = قيمة البنود + نسبة الشركة على المشتريات
                          const pct = phase.has_percentage && phase.percentage_value > 0 ? Number(phase.percentage_value) : 0;
                          const itemsRevenue = summary?.itemsTotal || 0;
                          const purchasesCommission = pct > 0 ? (summary?.purchasesTotal || 0) * pct / 100 : 0;
                          const totalRevenue = itemsRevenue + purchasesCommission;
                          // صافي الربح = الإيرادات المتوقعة - التكاليف الفعلية
                          const netProfit = totalRevenue - totalCosts;
                          // ما دفعه الزبون فعلياً
                          const clientPaidForProfit = phases?.length === 1 ? totalClientPaid : (summary?.clientPaid || 0);
                          // الربح الفعلي المحقق = ما دُفع فعلاً - التكاليف
                          const realizedProfit = clientPaidForProfit - totalCosts;
                          const showRealized = clientPaidForProfit > 0;
                          return (
                            <Card className={`border ${netProfit >= 0 ? 'bg-green-500/5 border-green-500/20' : 'bg-destructive/5 border-destructive/20'}`}>
                              <CardContent className="p-3">
                                <div className="flex items-center gap-2.5">
                                  <div className={`p-1.5 rounded-md ${netProfit >= 0 ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
                                    <TrendingUp className={`h-4 w-4 ${netProfit >= 0 ? 'text-green-500' : 'text-destructive'}`} />
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">صافي الربح المتوقع</p>
                                    <p className={`text-sm font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                                      {formatCurrencyLYD(netProfit)}
                                    </p>
                                    {showRealized && (
                                      <p className={`text-xs font-medium ${realizedProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                                        المحقق: {formatCurrencyLYD(realizedProfit)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })()}

                        {/* صافي ربح/خسارة الإيجارات */}
                        {(() => {
                          const rentalProfit = (summary?.rentalsTotal || 0);
                          
                          return (
                            <Card className={`border ${rentalProfit === 0 ? 'bg-muted/50 border-border' : 'bg-destructive/5 border-destructive/20'}`}>
                              <CardContent className="p-3">
                                <div className="flex items-center gap-2.5">
                                  <div className={`p-1.5 rounded-md ${rentalProfit === 0 ? 'bg-muted' : 'bg-destructive/10'}`}>
                                    <TrendingDown className={`h-4 w-4 ${rentalProfit === 0 ? 'text-muted-foreground' : 'text-destructive'}`} />
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">تكلفة الإيجارات</p>
                                    <p className={`text-sm font-bold ${rentalProfit === 0 ? 'text-muted-foreground' : 'text-destructive'}`}>
                                      {formatCurrencyLYD(rentalProfit)}
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })()}
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/projects/${projectId}/phases/${phase.id}/items`)}
                        >
                          <Package className="h-4 w-4 ml-2" />
                          فاتورة بنود المقاولات
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/projects/${projectId}/phases/${phase.id}/purchases`)}
                        >
                          <ShoppingCart className="h-4 w-4 ml-2" />
                          فواتير الخدمات والمشتريات
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/projects/${projectId}/phases/${phase.id}/equipment`)}
                        >
                          <Wrench className="h-4 w-4 ml-2" />
                          إيجارات المعدات
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/projects/${projectId}/phases/${phase.id}/expenses`)}
                        >
                          <Coins className="h-4 w-4 ml-2" />
                          المصروفات
                        </Button>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); else setDialogOpen(true); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {editingPhase ? "تعديل فاتورة المرحلة" : "إضافة فاتورة مرحلة جديدة"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Phase Name with Suggestions */}
            <div className="space-y-2">
              <Label htmlFor="phase-name" className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                اسم فاتورة المرحلة *
              </Label>
              <div className="relative">
                <Input
                  id="phase-name"
                  value={formData.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, name: val });
                    setNameQuery(val);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="ابدأ بالكتابة أو اختر من الاقتراحات..."
                  autoFocus
                  autoComplete="off"
                />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                    {filteredSuggestions.map((suggestion, i) => {
                      const isFromDB = allPhaseNames?.includes(suggestion);
                      return (
                        <button
                          key={i}
                          type="button"
                          className="w-full text-right px-3 py-2 text-sm hover:bg-accent/50 transition-colors flex items-center justify-between gap-2"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setFormData({ ...formData, name: suggestion });
                            setNameQuery(suggestion);
                            setShowSuggestions(false);
                          }}
                        >
                          <span>{suggestion}</span>
                          {isFromDB && (
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              مستخدم سابقاً
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="phase-desc" className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                الوصف
              </Label>
              <Textarea
                id="phase-desc"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                placeholder="وصف مختصر لنطاق العمل في هذه المرحلة..."
              />
            </div>

            {/* Status & Date in one row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                  الحالة
                </Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-yellow-500" />
                        قيد الانتظار
                      </span>
                    </SelectItem>
                    <SelectItem value="active">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        نشط
                      </span>
                    </SelectItem>
                    <SelectItem value="completed">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-sky-500" />
                        مكتمل
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phase-start" className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  تاريخ البداية
                </Label>
                <Input
                  id="phase-start"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
            </div>

            {/* Treasury Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                الخزينة
              </Label>
              <Select
                value={formData.treasury_id || "__none__"}
                onValueChange={(val) => setFormData({ ...formData, treasury_id: val === "__none__" ? "" : val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر الخزينة" />
                </SelectTrigger>
                <SelectContent>
                  {parentTreasuries.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="flex items-center gap-2">
                        {t.treasury_type === "bank" ? <Landmark className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                        {t.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Percentage Settings */}
            <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <Coins className="h-3.5 w-3.5 text-muted-foreground" />
                  المشتريات بنسبة
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{formData.has_percentage ? 'نعم' : 'لا'}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.has_percentage}
                    className={`peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${formData.has_percentage ? 'bg-primary' : 'bg-input'}`}
                    onClick={() => setFormData({ ...formData, has_percentage: !formData.has_percentage })}
                  >
                    <span className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${formData.has_percentage ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
              {formData.has_percentage && (
                <div className="space-y-2">
                  <Label htmlFor="percentage-value">قيمة النسبة %</Label>
                  <Input
                    id="percentage-value"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.percentage_value}
                    onChange={(e) => setFormData({ ...formData, percentage_value: e.target.value })}
                    placeholder="مثال: 15"
                  />
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="phase-notes">ملاحظات</Label>
              <Textarea
                id="phase-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                placeholder="ملاحظات إضافية..."
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCloseDialog} className="gap-1.5">
              <X className="h-4 w-4" />
              إلغاء
            </Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending} className="gap-1.5">
              {saveMutation.isPending ? (
                <>
                  <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {editingPhase ? "حفظ التعديلات" : "إضافة فاتورة المرحلة"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletePhaseId} onOpenChange={() => setDeletePhaseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف فاتورة المرحلة وجميع البنود والمشتريات والمصروفات المرتبطة بها.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePhaseId && deleteMutation.mutate(deletePhaseId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Client Print Options Dialog */}
      <Dialog open={!!clientPrintDialog} onOpenChange={(open) => !open && setClientPrintDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>خيارات طباعة الزبون</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">اختر الأقسام التي تريد إظهارها في فاتورة الزبون:</p>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={clientPrintOptions.showPurchases}
                  onCheckedChange={(checked) => setClientPrintOptions(prev => ({ ...prev, showPurchases: !!checked }))}
                />
                <span className="text-sm">فواتير الخدمات والمشتريات</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={clientPrintOptions.showRentals}
                  onCheckedChange={(checked) => setClientPrintOptions(prev => ({ ...prev, showRentals: !!checked }))}
                />
                <span className="text-sm">إيجارات المعدات</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={clientPrintOptions.showExpenses}
                  onCheckedChange={(checked) => setClientPrintOptions(prev => ({ ...prev, showExpenses: !!checked }))}
                />
                <span className="text-sm">المصروفات</span>
              </label>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setClientPrintDialog(null)}>إلغاء</Button>
            <div className="flex gap-2">
              <Button onClick={() => clientPrintDialog && handlePrintPhase(clientPrintDialog, 'client', 'print', clientPrintOptions)}>
                <Printer className="h-4 w-4 ml-1.5" />
                طباعة
              </Button>
              <Button variant="secondary" onClick={() => clientPrintDialog && handlePrintPhase(clientPrintDialog, 'client', 'pdf', clientPrintOptions)}>
                <Download className="h-4 w-4 ml-1.5" />
                تحميل PDF
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectPhases;
