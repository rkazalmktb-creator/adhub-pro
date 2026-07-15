import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight, Phone, Mail, Wrench, Briefcase, DollarSign, Calendar, Plus, Trash2, Filter, X, Wallet, TrendingUp, CreditCard, Printer, Coins } from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";
import { generatePrintStyles, getPrintValues } from "@/lib/printStyles";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";
import { useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";

const measurementUnits: Record<string, string> = {
  linear: "م.ط",
  square: "م²",
  cubic: "م³",
};

const TechnicianDetail = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [role, setRole] = useState("");

  // Filters state
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterItem, setFilterItem] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");

  // Withdrawal dialog state
  const [isWithdrawalDialogOpen, setIsWithdrawalDialogOpen] = useState(false);
  const [withdrawalForm, setWithdrawalForm] = useState({
    amount: "",
    date: format(new Date(), "yyyy-MM-dd"),
    description: "",
    notes: "",
  });

  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedPurchaseForPay, setSelectedPurchaseForPay] = useState<any>(null);
  const [payFormData, setPayFormData] = useState({
    amount: "",
    date: new Date().toISOString().split("T")[0],
    payment_method: "cash",
    treasury_id: "",
    commission: "",
    notes: "",
  });

  // Fetch company settings for printing
  const { data: companySettings } = useQuery({
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

  const handlePrintTechnicianReceipt = (exp: any) => {
    openReceiptPrintWindow({
      receiptNumber: `PAY-${exp.id.slice(0, 8)}`,
      date: exp.date,
      type: "salary",
      amount: Number(exp.amount || 0),
      paidToOrBy: technician?.name || "الفني",
      description: exp.description || `صرف مستحقات فني لدفعة عمل`,
      projectName: exp.project?.name || (exp.projectName !== "—" ? exp.projectName : undefined),
      notes: exp.notes || exp.rawObj?.notes || undefined,
    }, companySettings);
  };

  const { data: technician, isLoading: loadingTechnician } = useQuery({
    queryKey: ["technician", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technicians")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: projectAssignments, isLoading: loadingProjects } = useQuery({
    queryKey: ["technician-projects", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_technicians")
        .select(`
          *,
          project:projects(id, name, status, start_date, end_date, location)
        `)
        .eq("technician_id", id)
        .order("assigned_date", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: expenses } = useQuery({
    queryKey: ["technician-expenses", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select(`
          *,
          project:projects(id, name)
        `)
        .eq("technician_id", id)
        .eq("type", "labor")
        .order("date", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch active treasuries for payment dialog
  const { data: treasuries } = useQuery({
    queryKey: ["treasuries-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasuries")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch purchases linked to this technician (labor bills/invoices)
  const { data: purchases, isLoading: purchasesLoading } = useQuery({
    queryKey: ["technician-purchases", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select(`
          *,
          projects (
            id,
            name,
            project_type,
            client_id,
            clients (
              id,
              name,
              phone
            )
          )
        `)
        .eq("technician_id", id!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!id,
  });

  // Fetch purchase payments linked to this technician
  const { data: purchasePayments, isLoading: purchasePaymentsLoading } = useQuery({
    queryKey: ["technician-purchase-payments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_payments")
        .select(`
          *,
          purchases!inner (
            id,
            title,
            notes,
            invoice_number,
            technician_id,
            projects (
              id,
              name,
              clients (id, name)
            )
          ),
          treasuries (id, name)
        `)
        .eq("purchases.technician_id", id!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!id,
  });

  const payMutation = useMutation({
    mutationFn: async (data: typeof payFormData) => {
      if (!selectedPurchaseForPay) return;
      const { error } = await supabase
        .from("purchase_payments")
        .insert({
          purchase_id: selectedPurchaseForPay.id,
          amount: parseFloat(data.amount),
          date: data.date,
          payment_method: data.payment_method,
          treasury_id: data.treasury_id,
          commission: parseFloat(data.commission) || 0,
          notes: data.notes || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technician-purchases", id] });
      queryClient.invalidateQueries({ queryKey: ["technician-purchase-payments", id] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      toast.success("تم تسجيل الدفعة بنجاح ✨");
      setPayDialogOpen(false);
      setPayFormData({
        amount: "",
        date: new Date().toISOString().split("T")[0],
        payment_method: "cash",
        treasury_id: "",
        commission: "",
        notes: "",
      });
    },
    onError: (error) => {
      toast.error("خطأ أثناء تسجيل الدفعة: " + error.message);
    }
  });

  const handleOpenPayDialog = (purchase: any) => {
    setSelectedPurchaseForPay(purchase);
    const remaining = Number(purchase.total_amount) - Number(purchase.paid_amount || 0);
    
    const isFinishing = purchase.projects?.project_type === "finishing";
    const targetParentId = isFinishing 
      ? companySettings?.finishing_treasury_id 
      : companySettings?.contracting_treasury_id;
      
    const defaultTreasury = treasuries?.find((t: any) => t.parent_id === targetParentId || t.id === targetParentId);
    
    setPayFormData({
      amount: remaining.toString(),
      date: new Date().toISOString().split("T")[0],
      payment_method: "cash",
      treasury_id: defaultTreasury?.id || purchase.treasury_id || "",
      commission: "",
      notes: "",
    });
    setPayDialogOpen(true);
  };

  const { data: progressRecords } = useQuery({
    queryKey: ["technician-progress-records", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technician_progress_records")
        .select(
          `
          id,
          date,
          quantity_completed,
          notes,
          project_items (
            id,
            name,
            measurement_type,
            phase_id,
            projects (
              id,
              name
            ),
            project_phases (
              id,
              treasury_id,
              treasuries (
                id,
                name,
                parent_id
              )
            )
          )
        `
        )
        .eq("technician_id", id)
        .order("date", { ascending: false });

      if (error) throw error;
      return data as Array<{
        id: string;
        date: string;
        quantity_completed: number;
        notes: string | null;
        project_items: null | {
          id: string;
          name: string;
          measurement_type: string;
          phase_id: string | null;
          projects: null | {
            id: string;
            name: string;
          };
          project_phases: null | {
            id: string;
            treasury_id: string | null;
            treasuries: null | {
              id: string;
              name: string;
              parent_id: string | null;
            };
          };
        };
      }>;
    },
    enabled: !!id,
  });

  // Fetch all projects for assignment dialog
  const { data: allProjects } = useQuery({
    queryKey: ["projects-for-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, status")
        .in("status", ["active", "pending"])
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  // Fetch technician rates from project_item_technicians
  const { data: technicianRates } = useQuery({
    queryKey: ["technician-rates", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_item_technicians")
        .select("project_item_id, rate")
        .eq("technician_id", id);

      if (error) throw error;
      return data as Array<{ project_item_id: string; rate: number }>;
    },
    enabled: !!id,
  });

  // Filter out already assigned projects
  const assignedProjectIds = projectAssignments?.map(a => a.project?.id) || [];
  const availableProjects = allProjects?.filter(p => !assignedProjectIds.includes(p.id)) || [];

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProjectId || !id) throw new Error("Missing data");
      
      const { error } = await supabase.from("project_technicians").insert({
        project_id: selectedProjectId,
        technician_id: id,
        role: role || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technician-projects", id] });
      toast.success("تم تعيين الفني للمشروع بنجاح");
      setIsDialogOpen(false);
      setSelectedProjectId("");
      setRole("");
    },
    onError: () => {
      toast.error("حدث خطأ أثناء التعيين");
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from("project_technicians")
        .delete()
        .eq("id", assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technician-projects", id] });
      toast.success("تم إزالة الفني من المشروع");
    },
    onError: () => {
      toast.error("حدث خطأ أثناء الإزالة");
    },
  });

  // Withdrawal mutation
  const withdrawalMutation = useMutation({
    mutationFn: async (data: typeof withdrawalForm) => {
      const { error } = await supabase.from("expenses").insert({
        technician_id: id,
        type: "labor",
        amount: parseFloat(data.amount),
        date: data.date,
        description: data.description || `سحب نقدي - ${technician?.name}`,
        notes: data.notes || null,
        payment_method: "cash",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technician-expenses", id] });
      toast.success("تم تسجيل السحب بنجاح");
      setIsWithdrawalDialogOpen(false);
      setWithdrawalForm({
        amount: "",
        date: format(new Date(), "yyyy-MM-dd"),
        description: "",
        notes: "",
      });
    },
    onError: () => {
      toast.error("حدث خطأ أثناء تسجيل السحب");
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", expenseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technician-expenses", id] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      toast.success("تم حذف السحب وإعادة الرصيد للخزينة بنجاح 🗑️");
    },
    onError: (error: any) => {
      toast.error("خطأ أثناء حذف السحب: " + error.message);
    }
  });

  const deletePurchasePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from("purchase_payments")
        .delete()
        .eq("id", paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technician-purchases", id] });
      queryClient.invalidateQueries({ queryKey: ["technician-purchase-payments", id] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      toast.success("تم حذف الدفعة وإعادة الرصيد للخزينة بنجاح 🗑️");
    },
    onError: (error: any) => {
      toast.error("خطأ أثناء حذف الدفعة: " + error.message);
    }
  });

  const handleWithdrawal = () => {
    if (!withdrawalForm.amount || parseFloat(withdrawalForm.amount) <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح");
      return;
    }
    withdrawalMutation.mutate(withdrawalForm);
  };

  const handleAssign = () => {
    if (!selectedProjectId) {
      toast.error("يرجى اختيار مشروع");
      return;
    }
    assignMutation.mutate();
  };

  const isLoading = loadingTechnician || loadingProjects;

  // Calculate these before useMemo hooks that depend on them
  const totalWithdrawn = expenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;
  const totalProjects = projectAssignments?.length || 0;

  // ALL useMemo hooks MUST be called before any early returns
  const ratesMap = useMemo(() => {
    const map = new Map<string, number>();
    technicianRates?.forEach((r) => {
      map.set(r.project_item_id, Number(r.rate));
    });
    return map;
  }, [technicianRates]);

  const totalDeserved = useMemo(() => {
    if (!progressRecords) return 0;
    return progressRecords.reduce((sum, r) => {
      const itemId = r.project_items?.id;
      if (!itemId) return sum;
      const rate = ratesMap.get(itemId) || 0;
      return sum + Number(r.quantity_completed) * rate;
    }, 0);
  }, [progressRecords, ratesMap]);

  const remainingAmount = totalDeserved - totalWithdrawn;

  // Extract unique projects and items for filters
  const uniqueProjects = useMemo(() => {
    if (!progressRecords) return [];
    const projectsMap = new Map<string, string>();
    progressRecords.forEach((r) => {
      const projectId = r.project_items?.projects?.id;
      const projectName = r.project_items?.projects?.name;
      if (projectId && projectName) {
        projectsMap.set(projectId, projectName);
      }
    });
    return Array.from(projectsMap.entries()).map(([id, name]) => ({ id, name }));
  }, [progressRecords]);

  const uniqueItems = useMemo(() => {
    if (!progressRecords) return [];
    const itemsMap = new Map<string, string>();
    progressRecords.forEach((r) => {
      const itemId = r.project_items?.id;
      const itemName = r.project_items?.name;
      if (itemId && itemName) {
        itemsMap.set(itemId, itemName);
      }
    });
    return Array.from(itemsMap.entries()).map(([id, name]) => ({ id, name }));
  }, [progressRecords]);

  const combinedPayments = useMemo(() => {
    const list: any[] = [];
    
    // 1. Add direct expenses
    expenses?.forEach(exp => {
      list.push({
        id: exp.id,
        date: exp.date,
        sourceType: "expense",
        description: exp.description || "صرف مستحقات فني لدفعة عمل",
        projectName: exp.project?.name || "—",
        treasuryName: "—",
        paymentMethod: "cash",
        amount: Number(exp.amount),
        rawObj: exp
      });
    });
    
    // 2. Add purchase payments
    purchasePayments?.forEach(pay => {
      list.push({
        id: pay.id,
        date: pay.date,
        sourceType: "purchase_payment",
        description: pay.purchases?.title || pay.purchases?.notes || "دفعة فاتورة عمالة",
        projectName: pay.purchases?.projects?.name || "—",
        treasuryName: pay.treasuries?.name || "—",
        paymentMethod: pay.payment_method === "cash" ? "نقداً" : "صك بنكي",
        amount: Number(pay.amount),
        rawObj: pay
      });
    });
    
    // Sort descending by date
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, purchasePayments]);

  // Filtered progress records
  const filteredProgressRecords = useMemo(() => {
    if (!progressRecords) return [];
    return progressRecords.filter((r) => {
      // Filter by project
      if (filterProject !== "all" && r.project_items?.projects?.id !== filterProject) {
        return false;
      }
      // Filter by item
      if (filterItem !== "all" && r.project_items?.id !== filterItem) {
        return false;
      }
      // Filter by date range
      if (filterDateFrom && new Date(r.date) < new Date(filterDateFrom)) {
        return false;
      }
      if (filterDateTo && new Date(r.date) > new Date(filterDateTo)) {
        return false;
      }
      return true;
    });
  }, [progressRecords, filterProject, filterItem, filterDateFrom, filterDateTo]);

  const filteredTotalCompleted = filteredProgressRecords.reduce(
    (sum, r) => sum + Number(r.quantity_completed || 0),
    0
  );

  const filteredTotalDeserved = filteredProgressRecords.reduce((sum, r) => {
    const itemId = r.project_items?.id;
    if (!itemId) return sum;
    const rate = ratesMap.get(itemId) || 0;
    return sum + Number(r.quantity_completed) * rate;
  }, 0);

  // Calculate per-treasury summary (deserved, withdrawn, remaining)
  const treasurySummary = useMemo(() => {
    const summary: Record<string, { 
      treasuryId: string;
      treasuryName: string;
      projects: Record<string, {
        id: string;
        name: string;
        deserved: number;
        withdrawn: number;
        remaining: number;
      }>;
      totalDeserved: number;
      totalWithdrawn: number;
      totalRemaining: number;
    }> = {};

    const noTreasuryKey = "__no_treasury__";

    // Add deserved from progress records
    progressRecords?.forEach((r) => {
      const projectId = r.project_items?.projects?.id;
      const projectName = r.project_items?.projects?.name;
      if (!projectId || !projectName) return;

      const treasury = r.project_items?.project_phases?.treasuries;
      const treasuryKey = treasury?.id || noTreasuryKey;
      const treasuryName = treasury?.name || "بدون خزينة";

      if (!summary[treasuryKey]) {
        summary[treasuryKey] = { treasuryId: treasuryKey, treasuryName, projects: {}, totalDeserved: 0, totalWithdrawn: 0, totalRemaining: 0 };
      }
      if (!summary[treasuryKey].projects[projectId]) {
        summary[treasuryKey].projects[projectId] = { id: projectId, name: projectName, deserved: 0, withdrawn: 0, remaining: 0 };
      }

      const itemId = r.project_items?.id;
      const rate = itemId ? ratesMap.get(itemId) || 0 : 0;
      const amount = Number(r.quantity_completed) * rate;
      summary[treasuryKey].projects[projectId].deserved += amount;
      summary[treasuryKey].totalDeserved += amount;
    });

    // Add withdrawn from expenses (match to treasury via project phases)
    expenses?.forEach((exp) => {
      const projectId = exp.project?.id;
      const projectName = exp.project?.name;
      if (!projectId || !projectName) return;

      // Find which treasury this project's expenses belong to
      // Look through progress records to find a matching project → phase → treasury
      let treasuryKey = noTreasuryKey;
      for (const key of Object.keys(summary)) {
        if (summary[key].projects[projectId]) {
          treasuryKey = key;
          break;
        }
      }

      if (!summary[treasuryKey]) {
        summary[treasuryKey] = { treasuryId: treasuryKey, treasuryName: treasuryKey === noTreasuryKey ? "بدون خزينة" : summary[treasuryKey]?.treasuryName || "بدون خزينة", projects: {}, totalDeserved: 0, totalWithdrawn: 0, totalRemaining: 0 };
      }
      if (!summary[treasuryKey].projects[projectId]) {
        summary[treasuryKey].projects[projectId] = { id: projectId, name: projectName, deserved: 0, withdrawn: 0, remaining: 0 };
      }
      summary[treasuryKey].projects[projectId].withdrawn += Number(exp.amount);
      summary[treasuryKey].totalWithdrawn += Number(exp.amount);
    });

    // Calculate remaining
    Object.values(summary).forEach((t) => {
      Object.values(t.projects).forEach((p) => {
        p.remaining = p.deserved - p.withdrawn;
      });
      t.totalRemaining = t.totalDeserved - t.totalWithdrawn;
    });

    return Object.values(summary);
  }, [progressRecords, expenses, ratesMap]);

  const clearFilters = () => {
    setFilterProject("all");
    setFilterItem("all");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const hasActiveFilters =
    filterProject !== "all" || filterItem !== "all" || filterDateFrom || filterDateTo;

  // Print function for individual item
  const printItemDues = (record: typeof filteredProgressRecords[0]) => {
    const itemId = record.project_items?.id;
    const rate = itemId ? ratesMap.get(itemId) || 0 : 0;
    const deservedAmount = Number(record.quantity_completed) * rate;
    const settings = companySettings;
    const unit = measurementUnits[record.project_items?.measurement_type || "linear"];
    const v = getPrintValues(settings);

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      toast.error("تعذر فتح نافذة الطباعة - يرجى السماح بالنوافذ المنبثقة");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>مستحقات ${technician?.name} - ${record.project_items?.name}</title>
        <style>${generatePrintStyles(settings)}</style>
      </head>
      <body>
        <div class="print-btn-container">
          <button class="print-btn" onclick="window.print()">🖨️ طباعة</button>
          <button class="print-btn close-btn" onclick="window.close()">✕ إغلاق</button>
        </div>
        <div class="print-area">
          <div class="print-content">
            <div class="print-section">
              <h2 class="print-section-title">كشف مستحقات الفني</h2>
              <table class="print-info-table">
                <tbody>
                  <tr>
                    <td class="info-label">اسم الفني</td>
                    <td class="info-value">${technician?.name || "-"}</td>
                    <td class="info-label">التخصص</td>
                    <td class="info-value">${technician?.specialty || "-"}</td>
                  </tr>
                  <tr>
                    <td class="info-label">المشروع</td>
                    <td class="info-value">${record.project_items?.projects?.name || "-"}</td>
                    <td class="info-label">العنصر</td>
                    <td class="info-value">${record.project_items?.name || "-"}</td>
                  </tr>
                  <tr>
                    <td class="info-label">التاريخ</td>
                    <td class="info-value">${format(new Date(record.date), "yyyy/MM/dd", { locale: ar })}</td>
                    <td class="info-label">السعر</td>
                    <td class="info-value">${formatCurrencyLYD(rate)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

              ${(() => {
                const cleanNotes = (record.notes || "").trim();
                const displayNotes = (cleanNotes === "" || cleanNotes === "-") ? "" : cleanNotes;
                const hasNotes = displayNotes !== "";

                const cols = [
                  { header: "الكمية المنجزة", width: hasNotes ? "25%" : "33.33%", align: "center", render: () => `${Number(record.quantity_completed).toLocaleString()} ${unit}` },
                  { header: "السعر", width: hasNotes ? "25%" : "33.33%", align: "center", render: () => `${formatCurrencyLYD(rate)}` },
                  { header: "المستحق", width: hasNotes ? "25%" : "33.33%", align: "center", render: () => `<span style="font-weight: bold">${formatCurrencyLYD(deservedAmount)}</span>` },
                  ...(hasNotes ? [{ header: "ملاحظات", width: "25%", align: "center", render: () => `${displayNotes}` }] : [])
                ];

                return `
                <div class="print-section">
                  <h3 class="print-section-title">تفاصيل الإنجاز</h3>
                  <table class="print-table">
                    <thead>
                      <tr>
                        ${cols.map(c => `<th style="width: ${c.width}; text-align: center;">${c.header}</th>`).join("")}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        ${cols.map(c => `<td style="text-align: center;">${c.render()}</td>`).join("")}
                      </tr>
                    </tbody>
                  </table>
                </div>
                `;
              })()}

            <div class="total-box">
              <div class="label">إجمالي المستحق</div>
              <div class="value">${formatCurrencyLYD(deservedAmount)}</div>
            </div>

            <div class="print-footer">
              <span>تاريخ الطباعة: ${format(new Date(), "yyyy/MM/dd", { locale: ar })}</span>
              <span>${v.companyName}</span>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Early returns AFTER all hooks have been called
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  if (!technician) {
    return (
      <div className="space-y-6">
        <Link to="/technicians">
          <Button variant="ghost" className="gap-2">
            <ArrowRight className="h-4 w-4" />
            العودة للفنيين
          </Button>
        </Link>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold text-muted-foreground">الفني غير موجود</h2>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/20 text-green-500";
      case "completed":
        return "bg-blue-500/20 text-blue-500";
      case "pending":
        return "bg-yellow-500/20 text-yellow-500";
      case "cancelled":
        return "bg-red-500/20 text-red-500";
      default:
        return "bg-gray-500/20 text-gray-500";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "نشط";
      case "completed":
        return "مكتمل";
      case "pending":
        return "قيد الانتظار";
      case "cancelled":
        return "ملغي";
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Card - Name, Contact, Rates */}
      <div className="flex items-center gap-3 mb-2">
        <Link to="/technicians">
          <Button variant="ghost" size="icon">
            <ArrowRight className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">تفاصيل الفني</h1>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col md:flex-row md:items-start gap-5">
            {/* Avatar & Name */}
            <div className="flex items-center gap-4 min-w-0">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Wrench className="h-7 w-7 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold truncate">{technician.name}</h2>
                <p className="text-sm text-muted-foreground">{technician.specialty || "فني عام"}</p>
                <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground flex-wrap">
                  {technician.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      <span dir="ltr">{technician.phone}</span>
                    </span>
                  )}
                  {technician.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {technician.email}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Rates - compact inline */}
            <div className="flex flex-wrap gap-3 md:mr-auto">
              {technician.daily_rate && (
                <div className="px-3 py-2 rounded-lg bg-muted/60 text-center">
                  <p className="text-[10px] text-muted-foreground">يومي</p>
                  <p className="text-sm font-bold">{formatCurrencyLYD(technician.daily_rate)}</p>
                </div>
              )}
              {technician.hourly_rate && (
                <div className="px-3 py-2 rounded-lg bg-muted/60 text-center">
                  <p className="text-[10px] text-muted-foreground">بالساعة</p>
                  <p className="text-sm font-bold">{formatCurrencyLYD(technician.hourly_rate)}</p>
                </div>
              )}
              {(technician as any).meter_rate && (
                <div className="px-3 py-2 rounded-lg bg-muted/60 text-center">
                  <p className="text-[10px] text-muted-foreground">بالمتر</p>
                  <p className="text-sm font-bold">{formatCurrencyLYD((technician as any).meter_rate)}</p>
                </div>
              )}
              {(technician as any).piece_rate && (
                <div className="px-3 py-2 rounded-lg bg-muted/60 text-center">
                  <p className="text-[10px] text-muted-foreground">بالقطعة</p>
                  <p className="text-sm font-bold">{formatCurrencyLYD((technician as any).piece_rate)}</p>
                </div>
              )}
            </div>
          </div>

          {technician.notes && (
            <div className="mt-4 p-3 bg-muted/40 rounded-lg text-sm text-muted-foreground">
              {technician.notes}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Financial Summary - 4 compact cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-primary/20">
          <CardContent className="p-4 text-center">
            <Briefcase className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{totalProjects}</p>
            <p className="text-[11px] text-muted-foreground">المشاريع</p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 text-blue-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-blue-500">{formatCurrencyLYD(totalDeserved)}</p>
            <p className="text-[11px] text-muted-foreground">المستحق</p>
          </CardContent>
        </Card>
        <Card className="border-orange-500/20">
          <CardContent className="p-4 text-center">
            <Wallet className="h-5 w-5 text-orange-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-orange-500">{formatCurrencyLYD(totalWithdrawn)}</p>
            <p className="text-[11px] text-muted-foreground">المسحوب</p>
          </CardContent>
        </Card>
        <Card className={remainingAmount >= 0 ? "border-green-500/20" : "border-red-500/20"}>
          <CardContent className="p-4 text-center">
            <CreditCard className={`h-5 w-5 mx-auto mb-1 ${remainingAmount >= 0 ? "text-green-500" : "text-red-500"}`} />
            <p className={`text-2xl font-bold ${remainingAmount >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatCurrencyLYD(Math.abs(remainingAmount))}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {remainingAmount < 0 ? "سلفة" : "المتبقي"}
            </p>
            <Dialog open={isWithdrawalDialogOpen} onOpenChange={setIsWithdrawalDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="mt-2 gap-1 h-7 text-xs">
                  <Plus className="h-3 w-3" />
                  سحب
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>تسجيل سحب للفني</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="p-3 bg-muted/50 rounded-lg text-sm">
                    <div className="flex justify-between mb-1">
                      <span>المستحق:</span>
                      <span className="font-bold text-blue-500">{formatCurrencyLYD(totalDeserved)}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span>المسحوب:</span>
                      <span className="font-bold text-orange-500">{formatCurrencyLYD(totalWithdrawn)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1">
                      <span>المتبقي:</span>
                      <span className={`font-bold ${remainingAmount >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {formatCurrencyLYD(remainingAmount)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>المبلغ *</Label>
                    <Input
                      type="number"
                      value={withdrawalForm.amount}
                      onChange={(e) => setWithdrawalForm({ ...withdrawalForm, amount: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>التاريخ</Label>
                    <Input
                      type="date"
                      value={withdrawalForm.date}
                      onChange={(e) => setWithdrawalForm({ ...withdrawalForm, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الوصف</Label>
                    <Input
                      value={withdrawalForm.description}
                      onChange={(e) => setWithdrawalForm({ ...withdrawalForm, description: e.target.value })}
                      placeholder="سحب نقدي"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ملاحظات</Label>
                    <Textarea
                      value={withdrawalForm.notes}
                      onChange={(e) => setWithdrawalForm({ ...withdrawalForm, notes: e.target.value })}
                      placeholder="ملاحظات إضافية..."
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={handleWithdrawal}
                      className="flex-1"
                      disabled={withdrawalMutation.isPending}
                    >
                      {withdrawalMutation.isPending ? "جاري التسجيل..." : "تسجيل السحب"}
                    </Button>
                    <Button variant="outline" onClick={() => setIsWithdrawalDialogOpen(false)}>
                      إلغاء
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      {/* Projects Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>المشاريع المشارك بها</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                تعيين لمشروع
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>تعيين الفني لمشروع</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>المشروع *</Label>
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر المشروع" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProjects.length > 0 ? (
                        availableProjects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          لا توجد مشاريع متاحة
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>الدور (اختياري)</Label>
                  <Input
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="مثال: فني كهرباء رئيسي"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={handleAssign} 
                    className="flex-1"
                    disabled={assignMutation.isPending || !selectedProjectId}
                  >
                    {assignMutation.isPending ? "جاري التعيين..." : "تعيين"}
                  </Button>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    إلغاء
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {treasurySummary.length > 0 ? (
            <div className="space-y-6">
              {treasurySummary.map((treasury) => (
                <div key={treasury.treasuryId} className="border rounded-lg overflow-hidden">
                  {/* Treasury Header */}
                  <div className="bg-muted/60 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-primary" />
                      <span className="font-bold">{treasury.treasuryName}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span>المستحق: <span className="font-bold text-blue-500">{formatCurrencyLYD(treasury.totalDeserved)}</span></span>
                      <span>المسحوب: <span className="font-bold text-orange-500">{formatCurrencyLYD(treasury.totalWithdrawn)}</span></span>
                      <span className={`font-bold ${treasury.totalRemaining >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {treasury.totalRemaining >= 0 ? "المتبقي" : "سلفة"}: {formatCurrencyLYD(Math.abs(treasury.totalRemaining))}
                      </span>
                    </div>
                  </div>
                  {/* Projects Table */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">المشروع</TableHead>
                        <TableHead className="text-right">المستحق</TableHead>
                        <TableHead className="text-right">المسحوب</TableHead>
                        <TableHead className="text-right">المتبقي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.values(treasury.projects).map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">
                            <Link 
                              to={`/projects/${p.id}/edit`}
                              className="hover:text-primary hover:underline"
                            >
                              {p.name}
                            </Link>
                          </TableCell>
                          <TableCell className="font-bold text-blue-500">
                            {formatCurrencyLYD(p.deserved)}
                          </TableCell>
                          <TableCell className="font-bold text-orange-500">
                            {formatCurrencyLYD(p.withdrawn)}
                          </TableCell>
                          <TableCell className={`font-bold ${p.remaining >= 0 ? "text-green-500" : "text-red-500"}`}>
                            {formatCurrencyLYD(Math.abs(p.remaining))}
                            {p.remaining < 0 && " (سلفة)"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              لم يشارك هذا الفني في أي مشروع بعد
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress Records */}
      <Card>
        <CardHeader className="flex flex-col gap-4">
          <div className="flex flex-row items-center justify-between">
            <CardTitle>سجل الإنجازات</CardTitle>
            <Badge variant="secondary">
              إجمالي المنجز{hasActiveFilters ? " (مفلتر)" : ""}: {filteredTotalCompleted.toLocaleString()}
            </Badge>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-end gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">فلترة:</span>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">المشروع</Label>
              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="الكل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {uniqueProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">العنصر</Label>
              <Select value={filterItem} onValueChange={setFilterItem}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="الكل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {uniqueItems.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">من تاريخ</Label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-[150px] h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">إلى تاريخ</Label>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-[150px] h-9"
              />
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                <X className="h-4 w-4" />
                مسح الفلاتر
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredProgressRecords.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">المشروع</TableHead>
                    <TableHead className="text-right">العنصر</TableHead>
                    <TableHead className="text-right">المنجز</TableHead>
                    <TableHead className="text-right">المستحق</TableHead>
                    <TableHead className="text-right">ملاحظات</TableHead>
                    <TableHead className="text-center w-[80px]">طباعة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProgressRecords.map((r) => {
                    const itemId = r.project_items?.id;
                    const rate = itemId ? ratesMap.get(itemId) || 0 : 0;
                    const deservedAmount = Number(r.quantity_completed) * rate;
                    return (
                      <TableRow key={r.id}>
                        <TableCell>{format(new Date(r.date), "dd MMM yyyy", { locale: ar })}</TableCell>
                        <TableCell>{r.project_items?.projects?.name || "—"}</TableCell>
                        <TableCell className="font-medium">{r.project_items?.name || "—"}</TableCell>
                        <TableCell className="font-bold">{Number(r.quantity_completed).toLocaleString()} {measurementUnits[r.project_items?.measurement_type || "linear"]}</TableCell>
                        <TableCell className="font-bold text-blue-500">{formatCurrencyLYD(deservedAmount)}</TableCell>
                        <TableCell className="text-muted-foreground">{r.notes || "—"}</TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => printItemDues(r)}
                            title="طباعة"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="mt-4 p-3 bg-muted/50 rounded-lg flex justify-between items-center">
                <span className="text-sm font-medium">إجمالي المستحق (مفلتر):</span>
                <span className="text-lg font-bold text-blue-500">{formatCurrencyLYD(filteredTotalDeserved)}</span>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {hasActiveFilters
                ? "لا توجد نتائج تطابق الفلاتر المحددة"
                : "لا توجد إنجازات مسجلة لهذا الفني بعد"}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 1. Labor Invoices / Purchases Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>اليوميات وفواتير العمل المستحقة (العقود واليوميات)</CardTitle>
          <Badge variant="outline">{purchases?.length || 0} فاتورة عمل</Badge>
        </CardHeader>
        <CardContent>
          {purchases && purchases.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">الوصف / البيان</TableHead>
                  <TableHead className="text-right">المشروع</TableHead>
                  <TableHead className="text-right">القيمة المستحقة</TableHead>
                  <TableHead className="text-right">المدفوع</TableHead>
                  <TableHead className="text-right">المتبقي</TableHead>
                  <TableHead className="text-right">حالة السداد</TableHead>
                  <TableHead className="text-center w-[80px]">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((purchase) => {
                  const remaining = Number(purchase.total_amount) - Number(purchase.paid_amount || 0);
                  const statusLabels: Record<string, string> = {
                    paid: "مدفوع بالكامل",
                    due: "مستحق",
                    partial: "مدفوع جزئياً",
                  };
                  const statusColors: Record<string, string> = {
                    paid: "bg-green-500/10 text-green-500",
                    due: "bg-red-500/10 text-red-500",
                    partial: "bg-yellow-500/10 text-yellow-500",
                  };
                  return (
                    <TableRow key={purchase.id}>
                      <TableCell>{new Date(purchase.date).toLocaleDateString("ar-LY")}</TableCell>
                      <TableCell className="font-semibold">{purchase.title || purchase.notes || "يومية/فاتورة عمل"}</TableCell>
                      <TableCell>{purchase.projects?.name || "—"}</TableCell>
                      <TableCell className="font-bold">{formatCurrencyLYD(purchase.total_amount)}</TableCell>
                      <TableCell className="text-emerald-600 font-semibold">{formatCurrencyLYD(purchase.paid_amount || 0)}</TableCell>
                      <TableCell className={`font-bold ${remaining > 0.01 ? 'text-destructive font-black' : 'text-muted-foreground'}`}>{formatCurrencyLYD(remaining)}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[purchase.status || "due"]}>
                          {statusLabels[purchase.status || "due"]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {purchase.status !== "paid" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenPayDialog(purchase)}
                            title="تسجيل دفعة للفني"
                            className="cursor-pointer"
                          >
                            <Coins className="h-4 w-4 text-emerald-600" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              لا توجد فواتير عمل أو يوميات مسجلة لهذا الفني بعد.
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Received Payments Log Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>سجل المدفوعات المستلمة كاملة (المسحوبات والدفعات)</CardTitle>
          <Badge variant="outline">{combinedPayments.length} حركة دفع</Badge>
        </CardHeader>
        <CardContent>
          {combinedPayments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">الوصف / البيان</TableHead>
                  <TableHead className="text-right">المشروع</TableHead>
                  <TableHead className="text-right">الخزينة المصدر</TableHead>
                  <TableHead className="text-right">طريقة الدفع</TableHead>
                  <TableHead className="text-right">المبلغ المدفوع</TableHead>
                  <TableHead className="text-center w-[120px]">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {combinedPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {new Date(payment.date).toLocaleDateString("ar-LY")}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-xs">{payment.description}</div>
                      <div className="text-[10px] text-muted-foreground">
                        النوع: {payment.sourceType === "expense" ? "سحب نقدي مباشر" : "دفعة على حساب فاتورة"}
                      </div>
                    </TableCell>
                    <TableCell>{payment.projectName}</TableCell>
                    <TableCell className="font-semibold text-primary">{payment.treasuryName}</TableCell>
                    <TableCell className="text-xs">{payment.paymentMethod}</TableCell>
                    <TableCell className="font-bold text-emerald-600">
                      {formatCurrencyLYD(payment.amount)}
                    </TableCell>
                    <TableCell className="text-center flex justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 cursor-pointer h-8 w-8"
                        onClick={() => handlePrintTechnicianReceipt(payment)}
                        title="طباعة إيصال الصرف"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-red-700 hover:bg-red-50 cursor-pointer h-8 w-8"
                        onClick={() => {
                          if (confirm("هل أنت متأكد من رغبتك في حذف هذه الحركة وإلغاء أثرها المالي؟")) {
                            if (payment.sourceType === "expense") {
                              deleteExpenseMutation.mutate(payment.id);
                            } else {
                              deletePurchasePaymentMutation.mutate(payment.id);
                            }
                          }
                        }}
                        disabled={deleteExpenseMutation.isPending || deletePurchasePaymentMutation.isPending}
                        title="حذف الحركة وإرجاع الرصيد"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              لا توجد مدفوعات مستلمة مسجلة لهذا الفني بعد.
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Technician Payment Dialog (from purchases) */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>تسجيل دفعة مالية للفني</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedPurchaseForPay && (
              <div className="p-3 bg-muted rounded-lg text-xs space-y-1">
                <p><strong>عقد/فاتورة العمل:</strong> {selectedPurchaseForPay.title || selectedPurchaseForPay.notes || "فاتورة عمل فني"}</p>
                <p><strong>المبلغ الإجمالي:</strong> {formatCurrencyLYD(selectedPurchaseForPay.total_amount)}</p>
                <p><strong>المدفوع سابقاً:</strong> {formatCurrencyLYD(selectedPurchaseForPay.paid_amount || 0)}</p>
                <p className="text-destructive"><strong>المتبقي المستحق:</strong> {formatCurrencyLYD(Number(selectedPurchaseForPay.total_amount) - Number(selectedPurchaseForPay.paid_amount || 0))}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="pay_amount">المبلغ المدفوع (د.ل)</Label>
              <Input
                id="pay_amount"
                type="number"
                step="0.01"
                placeholder="أدخل قيمة الدفعة"
                value={payFormData.amount}
                onChange={(e) => setPayFormData({ ...payFormData, amount: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pay_date">التاريخ</Label>
              <Input
                id="pay_date"
                type="date"
                value={payFormData.date}
                onChange={(e) => setPayFormData({ ...payFormData, date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pay_method">طريقة الدفع</Label>
              <select
                id="pay_method"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={payFormData.payment_method}
                onChange={(e) => setPayFormData({ ...payFormData, payment_method: e.target.value as any })}
              >
                <option value="cash">نقداً</option>
                <option value="check">صك بنكي</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pay_treasury_id">الخزينة / الحساب المصرفي الصادر منه (محددة بناءً على نوع المشروع)</Label>
              <select
                id="pay_treasury_id"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold text-primary"
                value={payFormData.treasury_id}
                onChange={(e) => setPayFormData({ ...payFormData, treasury_id: e.target.value })}
              >
                <option value="">اختر الخزينة...</option>
                {(() => {
                  const isFinishing = selectedPurchaseForPay?.projects?.project_type === "finishing";
                  const targetParentId = isFinishing 
                    ? companySettings?.finishing_treasury_id 
                    : companySettings?.contracting_treasury_id;
                  
                  return treasuries
                    ?.filter((t: any) => t.parent_id === targetParentId || t.id === targetParentId)
                    ?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (الرصيد: {formatCurrencyLYD(t.balance || 0)})
                      </option>
                    ));
                })()}
              </select>
            </div>

            {payFormData.payment_method === "check" && (
              <div className="space-y-2">
                <Label htmlFor="pay_commission">العمولة المصرفية (إن وجدت)</Label>
                <Input
                  id="pay_commission"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={payFormData.commission}
                  onChange={(e) => setPayFormData({ ...payFormData, commission: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="pay_notes">ملاحظات</Label>
              <Input
                id="pay_notes"
                placeholder="أدخل أي ملاحظات إضافية"
                value={payFormData.notes}
                onChange={(e) => setPayFormData({ ...payFormData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPayDialogOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              onClick={() => payMutation.mutate(payFormData)}
              disabled={payMutation.isPending || !payFormData.amount || !payFormData.treasury_id}
            >
              {payMutation.isPending ? "جاري تسجيل الدفعة..." : "تسجيل الدفعة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TechnicianDetail;
