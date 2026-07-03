import { useState, useMemo, useEffect } from "react";
import { ProjectNavBar } from "@/components/layout/ProjectNavBar";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowRight, Plus, Pencil, Trash2, ShoppingCart, FileText, Printer, AlertTriangle, ArrowRightLeft, CheckSquare, X, Wallet, Landmark, Download, Layers } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { formatCurrencyLYD } from "@/lib/currency";
import { openPrintWindow, generatePrintStyles, getPrintValues } from "@/lib/printStyles";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import html2pdf from "html2pdf.js";
import { getElementLabels } from "@/lib/printLabels";

interface PurchaseItem {
  name: string;
  qty: number;
  price: number;
  unit: string;
}

interface Purchase {
  id: string;
  project_id: string;
  supplier_id: string | null;
  date: string;
  invoice_number: string | null;
  total_amount: number;
  status: string;
  items: unknown;
  notes: string | null;
  suppliers?: {
    id: string;
    name: string;
  } | null;
}

interface Supplier {
  id: string;
  name: string;
  category: string | null;
}

const statusLabels: Record<string, string> = {
  paid: "مدفوع",
  due: "مستحق",
  partial: "مدفوع جزئياً",
};

const statusColors: Record<string, string> = {
  paid: "bg-green-500/10 text-green-500",
  due: "bg-red-500/10 text-red-500",
  partial: "bg-yellow-500/10 text-yellow-500",
};


const ProjectPurchases = () => {
  const { id: projectId, phaseId } = useParams<{ id: string; phaseId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [forcedPhaseSelectorOpen, setForcedPhaseSelectorOpen] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [purchaseToMove, setPurchaseToMove] = useState<Purchase | null>(null);
  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState<string[]>([]);
  const [bulkMoveDialogOpen, setBulkMoveDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [targetPhaseId, setTargetPhaseId] = useState<string>("");
  const [selectedParentTreasuryId, setSelectedParentTreasuryId] = useState<string>("");
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [formData, setFormData] = useState({
    supplier_id: "",
    date: new Date().toISOString().split("T")[0],
    invoice_number: "",
    paid_amount: "",
    notes: "",
    items: [{ name: "", qty: 1, price: 0, unit: "" }] as PurchaseItem[],
    treasury_id: "",
    commission: "",
  });

  // Fetch project details
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

  // Fetch purchases
  const { data: purchases, isLoading: purchasesLoading } = useQuery({
    queryKey: ["project-purchases", projectId, phaseId],
    queryFn: async () => {
      let query = supabase
        .from("purchases")
        .select(`
          *,
          suppliers (id, name),
          treasuries (id, name, treasury_type)
        `)
        .eq("project_id", projectId!)
        .order("date", { ascending: false });
      
      if (phaseId) {
        query = query.eq("phase_id", phaseId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Purchase[];
    },
    enabled: !!projectId,
  });

  // Fetch suppliers
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, category")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Supplier[];
    },
  });

  // Fetch company settings for printing
  const { data: settings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // (Custody query removed - all purchases now go through treasury)

  // Fetch project phases for move dialog (with treasury info)
  const { data: projectPhases } = useQuery({
    queryKey: ["project-phases", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_phases")
        .select("id, name, order_index, treasury_id, has_percentage, percentage_value")
        .eq("project_id", projectId!)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  useEffect(() => {
    if (!phaseId && projectPhases) {
      setForcedPhaseSelectorOpen(true);
    } else {
      setForcedPhaseSelectorOpen(false);
    }
  }, [phaseId, projectPhases]);

  // Fetch all active treasuries (with parent info)
  const { data: allTreasuriesRaw = [] } = useQuery({
    queryKey: ["treasuries-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasuries")
        .select("id, name, balance, treasury_type, parent_id")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
  // Only sub-treasuries (children) should be selectable
  const treasuryParents = allTreasuriesRaw.filter(t => !(t as any).parent_id);
  const allTreasuries = allTreasuriesRaw.filter(t => (t as any).parent_id);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const totalAmount = data.items.reduce((sum, item) => sum + item.qty * item.price, 0);
      const paidAmount = parseFloat(data.paid_amount) || 0;
      const commission = parseFloat(data.commission) || 0;
      
      // Auto-calculate status
      let status: "due" | "paid" | "partial" = "due";
      if (paidAmount >= totalAmount && totalAmount > 0) {
        status = "paid";
      } else if (paidAmount > 0) {
        status = "partial";
      }
      
      const payload = {
        project_id: projectId!,
        phase_id: phaseId || null,
        supplier_id: data.supplier_id || null,
        date: data.date,
        invoice_number: data.invoice_number || null,
        status,
        notes: data.notes || null,
        items: JSON.parse(JSON.stringify(data.items.filter(item => item.name.trim()))),
        total_amount: totalAmount,
        paid_amount: paidAmount,
        fund_source: "treasury" as const,
        custody_id: null,
        treasury_id: data.treasury_id || null,
        commission,
      };

      if (editingPurchase) {
        const { error } = await supabase
          .from("purchases")
          .update(payload as any)
          .eq("id", editingPurchase.id);
        if (error) throw error;
        // DB trigger (handle_purchase_treasury_sync) handles treasury balance & transactions automatically
      } else {
        const { error } = await supabase.from("purchases").insert([payload as any]);
        if (error) throw error;
        // DB trigger (handle_purchase_treasury_sync) handles treasury balance & transactions automatically
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-purchases", projectId] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      toast({
        title: editingPurchase ? "تم تحديث المشترى" : "تم إضافة المشترى",
        description: editingPurchase
          ? "تم تحديث بيانات المشترى بنجاح"
          : "تم إضافة المشترى بنجاح",
      });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حفظ المشترى",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (purchaseId: string) => {
      // Delete related client payment allocations (not handled by DB trigger)
      await supabase
        .from("client_payment_allocations")
        .delete()
        .eq("reference_id", purchaseId);

      // Delete the purchase
      // DB trigger (handle_purchase_deletion) automatically:
      // - Deletes related treasury transactions
      // - Recalculates treasury balance
      const { error } = await supabase
        .from("purchases")
        .delete()
        .eq("id", purchaseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-purchases", projectId] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["phase-summary"] });
      toast({
        title: "تم حذف المشترى",
        description: "تم حذف المشترى وإرجاع الرصيد للخزينة بنجاح",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حذف المشترى",
        variant: "destructive",
      });
    },
  });

  // Move purchase to another phase mutation
  const movePurchaseMutation = useMutation({
    mutationFn: async ({ purchaseId, newPhaseId }: { purchaseId: string; newPhaseId: string | null }) => {
      const { error } = await supabase
        .from("purchases")
        .update({ phase_id: newPhaseId })
        .eq("id", purchaseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-purchases", projectId] });
      queryClient.invalidateQueries({ queryKey: ["phase-summary"] });
      toast({
        title: "تم نقل المشترى",
        description: "تم نقل المشترى إلى المرحلة الجديدة بنجاح",
      });
      setMoveDialogOpen(false);
      setPurchaseToMove(null);
      setTargetPhaseId("");
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء نقل المشترى",
        variant: "destructive",
      });
    },
  });

  // Bulk move purchases mutation
  const bulkMovePurchasesMutation = useMutation({
    mutationFn: async ({ purchaseIds, newPhaseId }: { purchaseIds: string[]; newPhaseId: string | null }) => {
      const { error } = await supabase
        .from("purchases")
        .update({ phase_id: newPhaseId })
        .in("id", purchaseIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-purchases", projectId] });
      queryClient.invalidateQueries({ queryKey: ["phase-summary"] });
      toast({
        title: "تم نقل المشتريات",
        description: `تم نقل ${selectedPurchaseIds.length} مشترى إلى المرحلة الجديدة بنجاح`,
      });
      setBulkMoveDialogOpen(false);
      setSelectedPurchaseIds([]);
      setTargetPhaseId("");
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء نقل المشتريات",
        variant: "destructive",
      });
    },
  });

  // Bulk delete purchases mutation
  const bulkDeletePurchasesMutation = useMutation({
    mutationFn: async (purchaseIds: string[]) => {
      // Delete related client payment allocations (not handled by DB trigger)
      await supabase
        .from("client_payment_allocations")
        .delete()
        .in("reference_id", purchaseIds);

      // Delete purchases one by one to trigger handle_purchase_deletion for each
      // which automatically cleans up treasury transactions and recalculates balance
      for (const pid of purchaseIds) {
        const { error } = await supabase.from("purchases").delete().eq("id", pid);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-purchases", projectId] });
      queryClient.invalidateQueries({ queryKey: ["phase-summary"] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      toast({
        title: "تم حذف المشتريات",
        description: `تم حذف ${selectedPurchaseIds.length} مشترى وإرجاع الأرصدة بنجاح`,
      });
      setBulkDeleteDialogOpen(false);
      setSelectedPurchaseIds([]);
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حذف المشتريات",
        variant: "destructive",
      });
    },
  });

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPurchase(null);
    setFormData({
      supplier_id: "",
      date: new Date().toISOString().split("T")[0],
      invoice_number: "",
      paid_amount: "",
      notes: "",
      items: [{ name: "", qty: 1, price: 0, unit: "" }],
      treasury_id: "",
      commission: "",
    });
    setSelectedParentTreasuryId("");
  };

  const handleOpenNewPurchase = () => {
    setEditingPurchase(null);
    // Auto-select treasury from current phase
    const currentPhase = phaseId ? projectPhases?.find(p => p.id === phaseId) : null;
    const phaseTreasuryId = currentPhase?.treasury_id || "";
    let parentId = "";
    let subTreasuryId = "";
    if (phaseTreasuryId) {
      // Check if the phase treasury is a parent (no parent_id) or a child
      const isParent = treasuryParents.find(t => t.id === phaseTreasuryId);
      if (isParent) {
        parentId = phaseTreasuryId;
        subTreasuryId = ""; // User picks the sub-treasury
      } else {
        const childTreasury = allTreasuries.find(t => t.id === phaseTreasuryId);
        if (childTreasury) {
          parentId = (childTreasury as any).parent_id || "";
          subTreasuryId = phaseTreasuryId;
        }
      }
    }
    setFormData({
      supplier_id: "",
      date: new Date().toISOString().split("T")[0],
      invoice_number: "",
      paid_amount: "",
      notes: "",
      items: [{ name: "", qty: 1, price: 0, unit: "" }],
      treasury_id: subTreasuryId,
      commission: "",
    });
    setSelectedParentTreasuryId(parentId);
    setDialogOpen(true);
  };

  // Check if current phase has a linked treasury (to make parent read-only)
  const phaseLinkedTreasuryId = (() => {
    if (!phaseId || !projectPhases) return "";
    const currentPhase = projectPhases.find(p => p.id === phaseId);
    return currentPhase?.treasury_id || "";
  })();

  const handleEdit = (purchase: Purchase) => {
    setEditingPurchase(purchase);
    setFormData({
      supplier_id: purchase.supplier_id || "",
      date: purchase.date,
      invoice_number: purchase.invoice_number || "",
      paid_amount: String((purchase as any).paid_amount || 0),
      notes: purchase.notes || "",
      items: Array.isArray(purchase.items) && purchase.items.length > 0
        ? (purchase.items as any[]).map((item: any) => ({ ...item, unit: item.unit || "" }))
        : [{ name: "", qty: 1, price: 0, unit: "" }],
      treasury_id: (purchase as any).treasury_id || "",
      commission: String((purchase as any).commission || 0),
    });
    // Set parent treasury for the two-step selection
    const treasuryId = (purchase as any).treasury_id;
    if (treasuryId) {
      const childTreasury = allTreasuries.find(t => t.id === treasuryId);
      if (childTreasury) {
        setSelectedParentTreasuryId((childTreasury as any).parent_id || "");
      }
    }
    setDialogOpen(true);
  };

  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { name: "", qty: 1, price: 0, unit: "" }],
    }));
  };

  const handleRemoveItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleItemChange = (index: number, field: keyof PurchaseItem, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const buildPrintableEl = (innerHtml: string): HTMLDivElement => {
    const v = getPrintValues(settings);
    const wrapper = document.createElement("div");
    wrapper.dir = "rtl";
    wrapper.style.cssText = "position:absolute;left:-9999px;top:0;width:210mm;height:297mm;background-color:#fff;box-sizing:border-box;";
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      ${generatePrintStyles(settings)}
      .print-area {
        position: relative !important;
        margin: 0 !important;
        box-shadow: none !important;
        width: 100% !important;
        height: 100% !important;
        background-size: 100% 100% !important;
      }
    `;
    wrapper.appendChild(styleEl);
    const inner = document.createElement("div");
    inner.innerHTML = innerHtml;
    wrapper.appendChild(inner);
    return wrapper;
  };

  const printViaCanvas = async (html: string, title: string) => {
    const el = buildPrintableEl(html);
    document.body.appendChild(el);
    await new Promise(r => setTimeout(r, 200));
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: null, scrollY: 0 });
    document.body.removeChild(el);
    const dataUrl = canvas.toDataURL("image/png");
    
    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const totalPages = Math.ceil(imgHeight / pageHeight);

    let pagesHtml = "";
    for (let i = 0; i < totalPages; i++) {
      const topOffset = -(i * pageHeight);
      pagesHtml += `
        <div class="page-container">
          <img src="${dataUrl}" style="top: ${topOffset}mm;" />
        </div>
      `;
    }

    const win = window.open("", "_blank", "width=900,height=750");
    if (!win) {
      toast({ title: "تعذّر الطباعة", description: "يرجى السماح بالنوافذ المنبثقة", variant: "destructive" });
      return;
    }
    win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>${title}</title><style>
      *{margin:0;padding:0;box-sizing:border-box}body{background:#e8e8e8;display:flex;flex-direction:column;align-items:center;padding:20px;font-family:'Tajawal',sans-serif}
      .toolbar{position:fixed;top:16px;left:50%;transform:translateX(-50%);display:flex;gap:10px;z-index:999;background:rgba(0,0,0,.65);padding:10px 20px;border-radius:50px;backdrop-filter:blur(8px)}
      button{padding:10px 22px;border:none;border-radius:50px;cursor:pointer;font-size:13px;font-family:'Tajawal',sans-serif;font-weight:bold;color:#fff;transition:all .2s}
      .btn-print{background:#2563eb}.btn-print:hover{background:#1d4ed8}
      .btn-close{background:#64748b}.btn-close:hover{background:#475569}
      .page-container{width:210mm;height:297mm;overflow:hidden;position:relative;background:#fff;page-break-after:always;break-after:page;box-shadow:0 4px 24px rgba(0,0,0,.15);border-radius:4px;margin-top:68px}
      .page-container:first-of-type{margin-top:68px}
      .page-container+ .page-container{margin-top:20px}
      .page-container img{position:absolute;left:0;width:210mm;height:auto;display:block}
      @media print{
        @page{size:A4;margin:0}
        .toolbar{display:none!important}
        body{background:#fff;padding:0}
        .page-container{margin:0!important;box-shadow:none!important;border-radius:0!important;page-break-after:always!important;break-after:page!important}
      }
    </style></head><body>
      <div class="toolbar">
        <button class="btn-print" onclick="window.print()">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-left: 6px;"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>طباعة
        </button>
        <button class="btn-close" onclick="window.close()">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-left: 6px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>إغلاق
        </button>
      </div>
      ${pagesHtml}
    </body></html>`);
    win.document.close();
  };

  const savePdfViaCanvas = async (html: string, filename: string) => {
    setIsPdfLoading(true);
    try {
      const el = buildPrintableEl(html);
      document.body.appendChild(el);
      await new Promise(r => setTimeout(r, 200));
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff", scrollY: 0 });
      document.body.removeChild(el);
      
      const imgData = canvas.toDataURL("image/png");
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, Math.min(imgHeight, pageHeight));
      pdf.save(filename);
      toast({ title: "تم حفظ الملف بنجاح" });
    } catch (error) {
      console.error("PDF export error:", error);
      toast({ title: "فشل حفظ الملف", variant: "destructive" });
    } finally {
      setIsPdfLoading(false);
    }
  };

  const buildInvoiceHTML = (purchase: Purchase) => {
    const items = Array.isArray(purchase.items) ? purchase.items : [];
    const pl = getElementLabels(settings?.print_labels, "purchases");

    return `
      <div class="print-area">
        <div class="print-content">
          <div class="print-section">
            <h2 class="print-section-title">${pl.title}</h2>
            <table class="print-info-table">
              <tbody>
                <tr>
                  <td class="info-label">${pl.label_invoice_number}</td>
                  <td class="info-value">${purchase.invoice_number || "-"}</td>
                  <td class="info-label">${pl.label_date}</td>
                  <td class="info-value">${format(new Date(purchase.date), "yyyy/MM/dd", { locale: ar })}</td>
                </tr>
                <tr>
                  <td class="info-label">${pl.label_supplier}</td>
                  <td class="info-value">${purchase.suppliers?.name || "-"}</td>
                  <td class="info-label">${pl.label_project}</td>
                  <td class="info-value">${project?.name || "-"}</td>
                </tr>
                <tr>
                  <td class="info-label">${pl.label_client}</td>
                  <td class="info-value">${project?.clients?.name || "-"}</td>
                  <td class="info-label">${pl.label_status}</td>
                  <td class="info-value">${statusLabels[purchase.status] || purchase.status}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="print-section">
            <h3 class="print-section-title">${pl.items_section}</h3>
            <table class="print-table">
              <thead>
                <tr>
                  <th style="width: 50px">${pl.col_number}</th>
                  <th>${pl.col_item}</th>
                  <th style="width: 80px">${pl.col_unit}</th>
                  <th style="width: 100px">${pl.col_quantity}</th>
                  <th style="width: 120px">${pl.col_price}</th>
                  <th style="width: 140px">${pl.col_total}</th>
                </tr>
              </thead>
              <tbody>
                ${items.map((item: PurchaseItem, idx: number) => `
                  <tr>
                    <td style="text-align: center">${idx + 1}</td>
                    <td style="text-align: center">${item.name}</td>
                    <td style="text-align: center">${item.unit || "-"}</td>
                    <td style="text-align: center">${item.qty}</td>
                    <td style="text-align: center">${formatCurrencyLYD(item.price)}</td>
                    <td style="text-align: center; font-weight: bold">${formatCurrencyLYD(item.qty * item.price)}</td>
                  </tr>
                `).join("")}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="5" style="text-align: center; font-weight: bold">${pl.total_label}</td>
                  <td style="text-align: center; font-weight: bold">${formatCurrencyLYD(purchase.total_amount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          ${purchase.notes && pl.show_notes ? `
          <div class="print-section">
            <h3 class="print-section-title">${pl.notes_section}</h3>
            <p style="padding: 8px; background: #f5f5f5; border-radius: 4px;">${purchase.notes}</p>
          </div>
          ` : ""}

          <div class="print-footer">
            <span class="print-date">تاريخ الطباعة: ${format(new Date(), "yyyy/MM/dd", { locale: ar })}</span>
            <span>${settings?.company_name || ""}</span>
          </div>
        </div>
      </div>
    `;
  };

  const handlePrintInvoice = (purchase: Purchase) => {
    const pl = getElementLabels(settings?.print_labels, "purchases");
    const supplierName = purchase.suppliers?.name || "مورد";
    const invoiceNum = purchase.invoice_number || purchase.id.slice(0, 8).toUpperCase();
    const dateStr = format(new Date(purchase.date), "dd-MM-yyyy");
    const windowTitle = `${pl.title} - ${supplierName} - رقم ${invoiceNum} - تاريخ ${dateStr}`;
    printViaCanvas(buildInvoiceHTML(purchase), windowTitle);
  };

  const handleSaveInvoicePdf = (purchase: Purchase) => {
    const pl = getElementLabels(settings?.print_labels, "purchases");
    const supplierName = purchase.suppliers?.name || "مورد";
    const invoiceNum = purchase.invoice_number || purchase.id.slice(0, 8).toUpperCase();
    const dateStr = format(new Date(purchase.date), "dd-MM-yyyy");
    const filename = `${pl.title.replace(/\s+/g, "_")}_${supplierName.replace(/\s+/g, "_")}_رقم_${invoiceNum}_تاريخ_${dateStr}.pdf`;
    savePdfViaCanvas(buildInvoiceHTML(purchase), filename);
  };

  const handleSubmit = () => {
    if (!formData.supplier_id) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار المورد",
        variant: "destructive",
      });
      return;
    }
    if (!formData.items.some(item => item.name.trim())) {
      toast({
        title: "خطأ",
        description: "يرجى إضافة بند واحد على الأقل",
        variant: "destructive",
      });
      return;
    }
    
    const paidAmount = parseFloat(formData.paid_amount) || 0;
    const totalAmount = formData.items.reduce((sum, item) => sum + item.qty * item.price, 0);
    
    if (paidAmount < 0) {
      toast({
        title: "خطأ",
        description: "القيمة المسددة لا يمكن أن تكون سالبة",
        variant: "destructive",
      });
      return;
    }
    
    if (paidAmount > totalAmount) {
      toast({
        title: "خطأ",
        description: "القيمة المسددة لا يمكن أن تتجاوز إجمالي الفاتورة",
        variant: "destructive",
      });
      return;
    }
    
    // Validate treasury selection
    if (!formData.treasury_id) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار الخزينة",
        variant: "destructive",
      });
      return;
    }
    
    const commissionAmount = parseFloat(formData.commission) || 0;
    const totalDeduction = paidAmount + commissionAmount;
    
    if (totalDeduction > 0) {
      const selectedTreasury = allTreasuries.find(t => t.id === formData.treasury_id);
      if (!selectedTreasury || totalDeduction > (selectedTreasury.balance || 0)) {
        toast({
          title: "خطأ",
          description: `رصيد الخزينة غير كافٍ. المطلوب: ${formatCurrencyLYD(totalDeduction)} - المتاح: ${formatCurrencyLYD(selectedTreasury?.balance || 0)}`,
          variant: "destructive",
        });
        return;
      }
    }
    
    saveMutation.mutate(formData);
  };

  const totalPurchases = purchases?.reduce((sum, p) => sum + Number(p.total_amount), 0) || 0;
  const paidPurchases = purchases?.reduce((sum, p) => sum + Number((p as any).paid_amount || 0), 0) || 0;
  const totalCommission = purchases?.reduce((sum, p) => sum + Number((p as any).commission || 0), 0) || 0;
  
  // Get phase percentage for service fee calculation
  const currentPhase = phaseId ? projectPhases?.find(p => p.id === phaseId) : null;
  
  // When viewing a specific phase, use its percentage; otherwise aggregate from all phases with percentage
  const phasePercentage = currentPhase?.has_percentage ? Number(currentPhase.percentage_value) : 0;
  
  // Calculate service fee: per-phase when phaseId exists, or sum across all purchases by their phase
  const serviceFeeAmount = useMemo(() => {
    if (phaseId && phasePercentage > 0) {
      return totalPurchases * phasePercentage / 100;
    }
    // No specific phase: calculate per purchase based on its own phase percentage
    if (!purchases || !projectPhases) return 0;
    return purchases.reduce((sum, p) => {
      const pPhase = (p as any).phase_id ? projectPhases.find(ph => ph.id === (p as any).phase_id) : null;
      const pct = pPhase?.has_percentage ? Number(pPhase.percentage_value) : 0;
      return sum + (pct > 0 ? Number(p.total_amount) * pct / 100 : 0);
    }, 0);
  }, [purchases, projectPhases, phaseId, phasePercentage, totalPurchases]);
  
  // For the stats card: show aggregated percentage info when no specific phase
  const allPhasesWithPercentage = useMemo(() => {
    if (!projectPhases) return [];
    return projectPhases.filter(p => p.has_percentage && Number(p.percentage_value) > 0);
  }, [projectPhases]);

  // Collect unique units from all existing purchases for suggestions
  const usedUnits = useMemo(() => {
    const units = new Set<string>();
    // Default common units
    ["قطعة", "متر", "متر مربع", "متر مكعب", "كيلو", "طن", "لتر", "كرتون", "علبة", "كيس"].forEach(u => units.add(u));
    // Units from existing purchases
    purchases?.forEach((p) => {
      if (Array.isArray(p.items)) {
        (p.items as any[]).forEach((item: any) => {
          if (item.unit && typeof item.unit === "string" && item.unit.trim()) {
            units.add(item.unit.trim());
          }
        });
      }
    });
    return Array.from(units);
  }, [purchases]);

  if (projectLoading || purchasesLoading) {
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

  return (
    <div className="space-y-6" dir="rtl">
      <ProjectNavBar />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">فواتير الخدمات والمشتريات</h1>
          <p className="text-muted-foreground">
            {project.name} - العميل: {project.clients?.name || "غير محدد"}
          </p>
        </div>
        {(() => {
          const isWarningBudget = project.budget_type === 'warning' || project.budget_type === 'fixed';
          const budget = Number(project.budget) || 0;
          const totalPurchases = purchases?.reduce((sum, p) => sum + Number(p.total_amount || 0), 0) || 0;
          const isBudgetExceeded = isWarningBudget && budget > 0 && totalPurchases >= budget;
          
          return (
            <>
              <Button onClick={handleOpenNewPurchase} disabled={isBudgetExceeded}>
                <Plus className="h-4 w-4 ml-2" />
                إضافة مشترى
              </Button>
              {isBudgetExceeded && (
                <p className="text-xs text-destructive mt-1">تم تجاوز الميزانية - لا يمكن إضافة مشتريات</p>
              )}
            </>
          );
        })()}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الفواتير</p>
                <p className="text-2xl font-bold">{purchases?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <FileText className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المشتريات</p>
                <p className="text-2xl font-bold">{formatCurrencyLYD(totalPurchases)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">المدفوع</p>
                <p className="text-2xl font-bold">{formatCurrencyLYD(paidPurchases)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Wallet className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">نسبة الخدمات</p>
                {phaseId && phasePercentage > 0 ? (
                  <>
                    <p className="text-2xl font-bold">{phasePercentage}%</p>
                    <p className="text-xs text-muted-foreground">{formatCurrencyLYD(serviceFeeAmount)}</p>
                    <p className="text-xs text-primary font-bold">المستحق: {formatCurrencyLYD(totalPurchases + serviceFeeAmount)}</p>
                  </>
                ) : !phaseId && allPhasesWithPercentage.length > 0 ? (
                  <>
                    <p className="text-2xl font-bold">{formatCurrencyLYD(serviceFeeAmount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {allPhasesWithPercentage.map(p => `${p.name}: ${p.percentage_value}%`).join(" | ")}
                    </p>
                    <p className="text-xs text-primary font-bold">المستحق: {formatCurrencyLYD(totalPurchases + serviceFeeAmount)}</p>
                  </>
                ) : (
                  <p className="text-2xl font-bold text-muted-foreground">غير محددة</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        {totalCommission > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Landmark className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي العمولات البنكية</p>
                  <p className="text-2xl font-bold">{formatCurrencyLYD(totalCommission)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Purchases Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>قائمة المشتريات</CardTitle>
          {selectedPurchaseIds.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                تم تحديد {selectedPurchaseIds.length} مشترى
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setBulkMoveDialogOpen(true)}
              >
                <ArrowRightLeft className="h-4 w-4 ml-1" />
                نقل المحدد
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setBulkDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 ml-1" />
                حذف المحدد
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedPurchaseIds([])}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {purchases && purchases.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={purchases.length > 0 && selectedPurchaseIds.length === purchases.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedPurchaseIds(purchases.map(p => p.id));
                        } else {
                          setSelectedPurchaseIds([]);
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead className="text-right">المورد</TableHead>
                  <TableHead className="text-right">رقم الفاتورة</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">البنود</TableHead>
                   <TableHead className="text-right">المبلغ</TableHead>
                   <TableHead className="text-right">طريقة الدفع</TableHead>
                   <TableHead className="text-right">العمولة</TableHead>
                   <TableHead className="text-right">نسبة الخدمات</TableHead>
                   <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((purchase) => {
                  const isSelected = selectedPurchaseIds.includes(purchase.id);
                  return (
                  <TableRow key={purchase.id} className={isSelected ? "bg-muted/50" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedPurchaseIds(prev => [...prev, purchase.id]);
                          } else {
                            setSelectedPurchaseIds(prev => prev.filter(id => id !== purchase.id));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {purchase.suppliers ? (
                        <Link 
                          to={`/suppliers/${purchase.suppliers.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {purchase.suppliers.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{purchase.invoice_number || "-"}</TableCell>
                    <TableCell>{purchase.date}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {Array.isArray(purchase.items) && purchase.items.slice(0, 2).map((item, idx) => (
                          <div key={idx} className="text-sm">
                            {item.name} ({item.qty}{item.unit ? ` ${item.unit}` : ""} × {formatCurrencyLYD(item.price)})
                          </div>
                        ))}
                        {Array.isArray(purchase.items) && purchase.items.length > 2 && (
                          <span className="text-xs text-muted-foreground">
                            +{purchase.items.length - 2} أخرى
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-bold">
                      {formatCurrencyLYD(purchase.total_amount)}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const treasury = (purchase as any).treasuries;
                        if (!treasury) return <span className="text-muted-foreground">-</span>;
                        const isCash = treasury.treasury_type === "cash";
                        return (
                          <Badge variant="outline" className={isCash ? "border-primary/30 text-primary" : "border-muted-foreground/30"}>
                            {isCash ? (
                              <><Wallet className="h-3 w-3 ml-1" />نقدي</>
                            ) : (
                              <><Landmark className="h-3 w-3 ml-1" />بنكي</>
                            )}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {Number((purchase as any).commission) > 0 ? (
                        <span className="font-medium">{formatCurrencyLYD(Number((purchase as any).commission))}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const purchasePhase = (purchase as any).phase_id 
                          ? projectPhases?.find(p => p.id === (purchase as any).phase_id) 
                          : currentPhase;
                        const pct = purchasePhase?.has_percentage ? Number(purchasePhase.percentage_value) : 0;
                        if (pct > 0) {
                          const feeValue = Number(purchase.total_amount) * pct / 100;
                          const totalDue = Number(purchase.total_amount) + feeValue;
                          return (
                            <div>
                              <span className="font-medium">{pct}%</span>
                              <span className="text-xs text-muted-foreground block">{formatCurrencyLYD(feeValue)}</span>
                              <span className="text-xs text-primary font-bold block">المستحق: {formatCurrencyLYD(totalDue)}</span>
                            </div>
                          );
                        }
                        return <span className="text-muted-foreground">-</span>;
                      })()}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[purchase.status]}>
                        {statusLabels[purchase.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setPurchaseToMove(purchase);
                            setTargetPhaseId("");
                            setMoveDialogOpen(true);
                          }}
                          title="نقل إلى مرحلة أخرى"
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePrintInvoice(purchase)}
                          title="طباعة الفاتورة"
                          className="cursor-pointer"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSaveInvoicePdf(purchase)}
                          disabled={isPdfLoading}
                          title="تحميل الفاتورة كـ PDF"
                          className="cursor-pointer"
                        >
                          <Download className="h-4 w-4 text-muted-foreground hover:text-primary" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(purchase)}
                          title="تعديل"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(purchase.id)}
                          title="حذف"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد مشتريات مضافة</p>
              <p className="text-sm">اضغط على "إضافة مشترى" لبدء إضافة مشتريات المشروع</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Forced Phase Selector Dialog */}
      <Dialog open={forcedPhaseSelectorOpen} onOpenChange={() => {}}>
        <DialogContent className="max-w-md [&>button]:hidden" dir="rtl" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Layers className="h-5 w-5 text-primary animate-pulse" />
              الرجاء اختيار مرحلة لعرض مشترياتها
            </DialogTitle>
            <DialogDescription className="text-right text-xs">
              يجب اختيار مرحلة معينة لعرض وإضافة المشتريات الخاصة بها.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-2 pt-4">
            {!projectPhases ? (
              <div className="py-4 text-center text-muted-foreground text-sm">جاري تحميل المراحل...</div>
            ) : projectPhases.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground">
                <p className="text-sm font-semibold mb-3">لا توجد مراحل مضافة لهذا المشروع بعد.</p>
                <Button 
                  onClick={() => {
                    setForcedPhaseSelectorOpen(false);
                    navigate(`/projects/${projectId}/phases`);
                  }}
                  className="w-full cursor-pointer"
                >
                  الذهاب لإنشاء مرحلة
                </Button>
              </div>
            ) : (
              <>
                {projectPhases.map((phase) => (
                  <Button
                    key={phase.id}
                    variant="outline"
                    className="w-full justify-start text-right h-12 text-sm font-semibold hover:bg-primary/5 hover:text-primary transition-all cursor-pointer"
                    onClick={() => {
                      setForcedPhaseSelectorOpen(false);
                      navigate(`/projects/${projectId}/phases/${phase.id}/purchases`);
                    }}
                  >
                    <Layers className="h-4 w-4 ml-2 text-primary shrink-0" />
                    <span>{phase.name}</span>
                  </Button>
                ))}
                
                <div className="border-t border-border my-2 pt-2 flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1 h-10 text-xs cursor-pointer"
                    onClick={() => {
                      setForcedPhaseSelectorOpen(false);
                    }}
                  >
                    عرض كل المشتريات
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1 h-10 text-xs text-muted-foreground hover:bg-muted cursor-pointer"
                    onClick={() => {
                      setForcedPhaseSelectorOpen(false);
                      navigate(`/projects/${projectId}/phases`);
                    }}
                  >
                    العودة لصفحة المراحل
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPurchase ? "تعديل مشترى" : "إضافة مشترى جديد"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المورد *</Label>
                <Select
                  value={formData.supplier_id}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, supplier_id: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المورد" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers?.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name} {supplier.category && `(${supplier.category})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>رقم الفاتورة</Label>
                <Input
                  value={formData.invoice_number}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, invoice_number: e.target.value }))
                  }
                  placeholder="أدخل رقم الفاتورة"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>التاريخ</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, date: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>القيمة المسددة *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.paid_amount}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, paid_amount: e.target.value }))
                  }
                  placeholder="أدخل المبلغ المسدد"
                />
                {(() => {
                  const totalAmount = formData.items.reduce((sum, item) => sum + item.qty * item.price, 0);
                  const paidAmount = parseFloat(formData.paid_amount) || 0;
                  if (totalAmount > 0 && paidAmount >= totalAmount) {
                    return <p className="text-xs text-green-600">مدفوع بالكامل</p>;
                  } else if (paidAmount > 0) {
                    return <p className="text-xs text-yellow-600">مدفوع جزئياً ({formatCurrencyLYD(totalAmount - paidAmount)} متبقي)</p>;
                  } else if (totalAmount > 0) {
                    return <p className="text-xs text-destructive">مستحق</p>;
                  }
                  return null;
                })()}
              </div>
            </div>

            {/* Items Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>بنود الفاتورة</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                  <Plus className="h-4 w-4 ml-1" />
                  إضافة بند
                </Button>
              </div>
              {formData.items.map((item, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="اسم البند"
                      value={item.name}
                      onChange={(e) => handleItemChange(index, "name", e.target.value)}
                      className="flex-1"
                    />
                    <div className="relative w-28">
                      <Input
                        placeholder="الوحدة"
                        value={item.unit || ""}
                        onChange={(e) => handleItemChange(index, "unit", e.target.value)}
                        list={`unit-suggestions-${index}`}
                      />
                      <datalist id={`unit-suggestions-${index}`}>
                        {usedUnits.map((u) => (
                          <option key={u} value={u} />
                        ))}
                      </datalist>
                    </div>
                    <Input
                      type="number"
                      placeholder="الكمية"
                      value={item.qty}
                      onChange={(e) => handleItemChange(index, "qty", parseInt(e.target.value) || 0)}
                      className="w-24"
                    />
                    <Input
                      type="number"
                      placeholder="السعر"
                      value={item.price}
                      onChange={(e) => handleItemChange(index, "price", parseFloat(e.target.value) || 0)}
                      className="w-32"
                    />
                    <span className="text-sm font-medium w-24 text-left">
                      {formatCurrencyLYD(item.qty * item.price)}
                    </span>
                    {formData.items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex justify-end border-t pt-2">
                <span className="font-bold">
                  الإجمالي: {formatCurrencyLYD(formData.items.reduce((sum, item) => sum + item.qty * item.price, 0))}
                </span>
              </div>
            </div>

            {/* Treasury Selection Section */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">الخزينة *</Label>
              <div className="p-3 bg-muted/50 rounded-lg border space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>الخزينة الرئيسية</Label>
                    {phaseLinkedTreasuryId && selectedParentTreasuryId ? (
                      <div className="flex items-center gap-2 p-2.5 bg-muted rounded-md border text-sm">
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                        <span>{treasuryParents.find(t => t.id === selectedParentTreasuryId)?.name || "خزينة المرحلة"}</span>
                        <Badge variant="secondary" className="text-xs mr-auto">من المرحلة</Badge>
                      </div>
                    ) : (
                      <Select
                        value={selectedParentTreasuryId}
                        onValueChange={(value) => {
                          setSelectedParentTreasuryId(value);
                          setFormData((prev) => ({ ...prev, treasury_id: "" }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الخزينة" />
                        </SelectTrigger>
                        <SelectContent>
                          {treasuryParents.length === 0 ? (
                            <SelectItem value="none" disabled>لا توجد خزائن</SelectItem>
                          ) : (
                            treasuryParents.map((parent) => (
                              <SelectItem key={parent.id} value={parent.id}>
                                <span className="flex items-center gap-2">
                                  <Wallet className="h-4 w-4 text-muted-foreground" />
                                  {parent.name}
                                </span>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>الفرع</Label>
                    <Select
                      value={formData.treasury_id}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, treasury_id: value }))
                      }
                      disabled={!selectedParentTreasuryId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الفرع" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          const children = allTreasuries.filter(c => (c as any).parent_id === selectedParentTreasuryId);
                          return children.length === 0 ? (
                            <SelectItem value="none" disabled>اختر خزينة أولاً</SelectItem>
                          ) : (
                            children.map((child) => (
                              <SelectItem key={child.id} value={child.id}>
                                <span className="flex items-center gap-2">
                                  {(child as any).treasury_type === "bank" ? (
                                    <Landmark className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <Wallet className="h-4 w-4 text-muted-foreground" />
                                  )}
                                  {child.name} - {formatCurrencyLYD(child.balance || 0)}
                                </span>
                              </SelectItem>
                            ))
                          );
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Treasury balance warning */}
                {formData.treasury_id && (() => {
                  const selectedTreasury = allTreasuries.find(t => t.id === formData.treasury_id);
                  const paidAmount = parseFloat(formData.paid_amount) || 0;
                  const commissionAmt = parseFloat(formData.commission) || 0;
                  const totalDeduction = paidAmount + commissionAmt;
                  if (selectedTreasury) {
                    return (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          الرصيد المتاح: <span className="font-bold">{formatCurrencyLYD(selectedTreasury.balance || 0)}</span>
                        </p>
                        {totalDeduction > (selectedTreasury.balance || 0) && (
                          <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              رصيد الخزينة غير كافٍ! المطلوب: {formatCurrencyLYD(totalDeduction)} - المتاح: {formatCurrencyLYD(selectedTreasury.balance || 0)}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Commission field for bank treasuries */}
                {formData.treasury_id && (() => {
                  const selectedTreasury = allTreasuries.find(t => t.id === formData.treasury_id);
                  if (selectedTreasury && (selectedTreasury as any).treasury_type === "bank") {
                    return (
                      <div className="space-y-2">
                        <Label>عمولة التحويل</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.commission}
                          onChange={(e) => setFormData((prev) => ({ ...prev, commission: e.target.value }))}
                          placeholder="أدخل عمولة التحويل البنكي"
                        />
                        {parseFloat(formData.commission) > 0 && (
                          <p className="text-xs text-muted-foreground">
                            سيتم خصم {formatCurrencyLYD(parseFloat(formData.commission))} كعمولة تحويل إضافة للمبلغ المسدد
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* No treasuries warning */}
                {allTreasuries.length === 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      لا توجد خزائن نشطة. يرجى إضافة خزينة أولاً من صفحة الخزائن.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="أدخل أي ملاحظات إضافية"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              إلغاء
            </Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Purchase to Phase Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              نقل المشترى إلى مرحلة أخرى
            </DialogTitle>
            <DialogDescription>
              {purchaseToMove && `نقل فاتورة ${purchaseToMove.invoice_number || purchaseToMove.id.slice(0, 8)} إلى مرحلة أخرى`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>اختر المرحلة الهدف</Label>
              <Select
                value={targetPhaseId}
                onValueChange={setTargetPhaseId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر المرحلة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون مرحلة (المشروع الرئيسي)</SelectItem>
                  {projectPhases?.filter(p => p.id !== phaseId).map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      {phase.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={() => {
                if (purchaseToMove) {
                  movePurchaseMutation.mutate({
                    purchaseId: purchaseToMove.id,
                    newPhaseId: targetPhaseId === "none" ? null : targetPhaseId,
                  });
                }
              }}
              disabled={!targetPhaseId || movePurchaseMutation.isPending}
            >
              {movePurchaseMutation.isPending ? "جاري النقل..." : "نقل المشترى"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Move Purchases Dialog */}
      <Dialog open={bulkMoveDialogOpen} onOpenChange={setBulkMoveDialogOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              نقل {selectedPurchaseIds.length} مشترى
            </DialogTitle>
            <DialogDescription>
              نقل المشتريات المحددة إلى مرحلة أخرى
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>اختر المرحلة الهدف</Label>
              <Select
                value={targetPhaseId}
                onValueChange={setTargetPhaseId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر المرحلة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون مرحلة (المشروع الرئيسي)</SelectItem>
                  {projectPhases?.filter(p => p.id !== phaseId).map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      {phase.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBulkMoveDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={() => {
                bulkMovePurchasesMutation.mutate({
                  purchaseIds: selectedPurchaseIds,
                  newPhaseId: targetPhaseId === "none" ? null : targetPhaseId,
                });
              }}
              disabled={!targetPhaseId || bulkMovePurchasesMutation.isPending}
            >
              {bulkMovePurchasesMutation.isPending ? "جاري النقل..." : `نقل ${selectedPurchaseIds.length} مشترى`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Purchases Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              حذف {selectedPurchaseIds.length} مشترى
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2">
                <p>هل أنت متأكد من حذف المشتريات المحددة؟</p>
                <p className="text-destructive text-sm">
                  هذا الإجراء لا يمكن التراجع عنه.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => bulkDeletePurchasesMutation.mutate(selectedPurchaseIds)}
              disabled={bulkDeletePurchasesMutation.isPending}
            >
              {bulkDeletePurchasesMutation.isPending ? "جاري الحذف..." : `حذف ${selectedPurchaseIds.length} مشترى`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProjectPurchases;
