import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  ArrowRight, 
  Phone, 
  Mail, 
  MapPin, 
  Truck, 
  FolderOpen, 
  Building, 
  ShoppingCart,
  ChevronLeft,
  X,
  Coins,
  Wallet,
  Printer,
  Trash2,
  Settings,
  Sparkles,
  Pencil
} from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";
import { openReceiptPrintWindow } from "@/lib/printStyles";
import { useState, useMemo } from "react";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const statusLabels: Record<string, string> = {
  paid: "مدفوع",
  due: "مستحق",
  partial: "مدفوع جزئياً",
  processing: "قيد المعالجة",
};

const statusColors: Record<string, string> = {
  paid: "bg-green-500/10 text-green-500",
  due: "bg-red-500/10 text-red-500",
  partial: "bg-yellow-500/10 text-yellow-500",
  processing: "bg-blue-500/10 text-blue-500",
};

const translateCategory = (cat: string | null): string => {
  if (!cat) return "";
  const map: Record<string, string> = {
    supplier: "مورد",
    labor: "عمالة / مقاول",
  };
  return map[cat.toLowerCase()] || cat;
};

interface Purchase {
  id: string;
  project_id: string | null;
  supplier_id: string | null;
  date: string;
  invoice_number: string | null;
  total_amount: number;
  status: string;
  items: any[];
  notes: string | null;
  projects?: {
    id: string;
    name: string;
    client_id: string | null;
    clients?: {
      id: string;
      name: string;
    } | null;
  } | null;
}

const SupplierDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const queryClient = useQueryClient();
  const [projectTypeTab, setProjectTypeTab] = useState<"all" | "contracting" | "finishing">("all");
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [dialogProjectType, setDialogProjectType] = useState<"contracting" | "finishing">("contracting");
  const [dialogProjectId, setDialogProjectId] = useState<string>("");
  const [selectedPurchaseForPay, setSelectedPurchaseForPay] = useState<any | null>(null);
  const [payFormData, setPayFormData] = useState({
    amount: "",
    date: new Date().toISOString().split("T")[0],
    payment_method: "cash",
    treasury_id: "",
    commission: "",
    notes: "",
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

  // Fetch company settings to identify finishing/contracting treasury links
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

  // Fetch payments list for this supplier's purchases
  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["supplier-payments-list", id],
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
            supplier_id,
            projects (
              id,
              name,
              project_type,
              clients (id, name)
             )
          ),
          treasuries (id, name)
        `)
        .eq("purchases.supplier_id", id!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!id,
  });

  const payMutation = useMutation({
    mutationFn: async (data: typeof payFormData) => {
      if (selectedPurchaseForPay) {
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
      } else if (dialogProjectId) {
        // Pay off unpaid purchases belonging to THIS PROJECT ONLY
        const projectPurchases = purchases
          ?.filter(p => 
            p.status !== 'paid' && 
            p.project_id === dialogProjectId
          )
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) || [];

        if (projectPurchases.length === 0) {
          throw new Error("لا توجد فواتير مستحقة الدفع لهذا المشروع");
        }

        let remainingPayment = parseFloat(data.amount);
        if (isNaN(remainingPayment) || remainingPayment <= 0) {
          throw new Error("يرجى إدخال مبلغ صحيح");
        }

        const projName = projectPurchases[0]?.projects?.name || "المشروع";

        for (const purchase of projectPurchases) {
          if (remainingPayment <= 0) break;
          const purchaseRemaining = Number(purchase.total_amount) - Number((purchase as any).paid_amount || 0);
          const amountToPay = Math.min(remainingPayment, purchaseRemaining);
          
          const { data: insertedPay, error } = await supabase
            .from("purchase_payments")
            .insert({
              purchase_id: purchase.id,
              amount: amountToPay,
              date: data.date,
              payment_method: data.payment_method,
              treasury_id: data.treasury_id,
              notes: data.notes || `سداد حساب المورد لمشروع: ${projName}`,
            })
            .select("id")
            .single();

          if (error) throw error;

          if (data.treasury_id && insertedPay) {
            await supabase.from("treasury_transactions").insert({
              treasury_id: data.treasury_id,
              type: "withdrawal",
              amount: amountToPay,
              balance_after: 0,
              description: `سداد مدفوعات مورد: ${supplier?.name || ""}`,
              date: data.date,
              source: "purchase_payments",
              reference_type: "purchase_payment",
              reference_id: insertedPay.id,
              notes: data.notes || `سداد حساب المورد لمشروع: ${projName}`,
            });
          }

          remainingPayment -= amountToPay;
        }
      } else {
        throw new Error("يرجى اختيار مشروع لتسجيل الدفعة");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-purchases", id] });
      queryClient.invalidateQueries({ queryKey: ["supplier-payments-list", id] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      toast({ title: "تم تسجيل وتخصيص الدفعة للمشروع بنجاح" });
      setPayDialogOpen(false);
      setPayFormData({
        amount: "",
        date: new Date().toISOString().split("T")[0],
        payment_method: "cash",
        treasury_id: "",
        commission: "",
        notes: "",
      });
      setSelectedPurchaseForPay(null);
      setDialogProjectId("");
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ أثناء تسجيل الدفعة",
        variant: "destructive",
      });
    },
  });

  const handleOpenPayDialog = (purchase: any) => {
    setSelectedPurchaseForPay(purchase);
    const client = purchase.projects?.clients;
    setDialogClientId(client?.id || "");
    setDialogProjectId(purchase.project_id || "");
    
    const remaining = Number(purchase.total_amount) - Number(purchase.paid_amount || 0);
    
    // Auto-select treasury based on project type
    const isFinishing = purchase.projects?.project_type === "finishing";
    const targetParentId = isFinishing 
      ? companySettings?.finishing_treasury_id 
      : companySettings?.contracting_treasury_id;
      
    // Find the first sub-treasury of this parent, or the parent itself
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
  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from("purchase_payments")
        .delete()
        .eq("id", paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-purchases", id] });
      queryClient.invalidateQueries({ queryKey: ["supplier-payments-list", id] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      toast({ title: "تم حذف الدفعة وإعادة رصيد الخزينة بنجاح" });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ أثناء الحذف",
        description: error.message || "حدث خطأ غير متوقع",
        variant: "destructive"
      });
    }
  });

  const [editingPayment, setEditingPayment] = useState<any | null>(null);
  const [editPayDialogOpen, setEditPayDialogOpen] = useState(false);
  const [editPayFormData, setEditPayFormData] = useState({
    amount: "",
    date: new Date().toISOString().split("T")[0],
    payment_method: "cash",
    treasury_id: "",
    commission: "",
    notes: "",
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async (data: typeof editPayFormData) => {
      if (!editingPayment) return;
      const amountVal = parseFloat(data.amount);
      if (isNaN(amountVal) || amountVal <= 0) {
        throw new Error("يرجى إدخال مبلغ صحيح");
      }

      // 1. Update purchase_payments
      const { error: payErr } = await supabase
        .from("purchase_payments")
        .update({
          amount: amountVal,
          date: data.date,
          payment_method: data.payment_method,
          treasury_id: data.treasury_id,
          commission: parseFloat(data.commission) || 0,
          notes: data.notes || null,
        })
        .eq("id", editingPayment.id);

      if (payErr) throw payErr;

      // 2. Update linked treasury transaction if exists
      await supabase
        .from("treasury_transactions")
        .update({
          amount: amountVal,
          date: data.date,
          treasury_id: data.treasury_id,
          commission: parseFloat(data.commission) || 0,
          notes: data.notes || null,
        })
        .eq("reference_id", editingPayment.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-purchases", id] });
      queryClient.invalidateQueries({ queryKey: ["supplier-payments-list", id] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      toast({ title: "تم تعديل الدفعة بنجاح" });
      setEditPayDialogOpen(false);
      setEditingPayment(null);
    },
    onError: (error: any) => {
      toast({
        title: "خطأ أثناء التعديل",
        description: error.message || "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    },
  });

  const handleOpenEditPayment = (payment: any) => {
    setEditingPayment(payment);
    setEditPayFormData({
      amount: (payment.amount || 0).toString(),
      date: payment.date ? payment.date.split("T")[0] : new Date().toISOString().split("T")[0],
      payment_method: payment.payment_method || "cash",
      treasury_id: payment.treasury_id || "",
      commission: (payment.commission || 0).toString(),
      notes: payment.notes || "",
    });
    setEditPayDialogOpen(true);
  };
  const [clientPayDialogOpen, setClientPayDialogOpen] = useState(false);
  const [selectedClientForPay, setSelectedClientForPay] = useState<any>(null);
  const [clientPayFormData, setClientPayFormData] = useState({
    amount: "",
    date: new Date().toISOString().split("T")[0],
    payment_method: "cash",
    treasury_id: "",
    notes: "",
  });

  const clientPayMutation = useMutation({
    mutationFn: async (data: typeof clientPayFormData) => {
      if (!selectedClientForPay) return;
      
      const clientProjects = Object.values(selectedClientForPay.projects).map((p: any) => p.project.id);
      
      const unpaidPurchases = purchases
        ?.filter(p => 
          p.status !== 'paid' && 
          p.project_id && 
          clientProjects.includes(p.project_id)
        )
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) || [];

      if (unpaidPurchases.length === 0) {
        throw new Error("لا توجد فواتير مستحقة الدفع لهذا الزبون");
      }

      let remainingPayment = parseFloat(data.amount);
      if (isNaN(remainingPayment) || remainingPayment <= 0) {
        throw new Error("يرجى إدخال مبلغ صحيح");
      }

      for (const purchase of unpaidPurchases) {
        if (remainingPayment <= 0) break;
        const purchaseRemaining = Number(purchase.total_amount) - Number(purchase.paid_amount || 0);
        const amountToPay = Math.min(remainingPayment, purchaseRemaining);
        
        const { error } = await supabase
          .from("purchase_payments")
          .insert({
            purchase_id: purchase.id,
            amount: amountToPay,
            date: data.date,
            payment_method: data.payment_method,
            treasury_id: data.treasury_id,
            notes: data.notes || `دفعة على الحساب للزبون ${selectedClientForPay.client.name}`,
          });

        if (error) throw error;
        remainingPayment -= amountToPay;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-purchases", id] });
      queryClient.invalidateQueries({ queryKey: ["supplier-payments-list", id] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      toast({ title: "تم تسجيل وتوزيع الدفعة على الحساب بنجاح" });
      setClientPayDialogOpen(false);
      setClientPayFormData({
        amount: "",
        date: new Date().toISOString().split("T")[0],
        payment_method: "cash",
        treasury_id: "",
        notes: "",
      });
      setSelectedClientForPay(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "خطأ أثناء تسجيل الدفعة", 
        description: error.message || "حدث خطأ غير متوقع",
        variant: "destructive"
      });
    }
  });

  const handleOpenClientPayDialog = (clientData: any) => {
    setSelectedClientForPay(clientData);
    const clientRemaining = clientData.totalAmount - clientData.paidAmount;
    
    const defaultTreasury = treasuries?.find((t: any) => 
      t.parent_id === companySettings?.finishing_treasury_id || 
      t.parent_id === companySettings?.contracting_treasury_id
    );
    
    setClientPayFormData({
      amount: clientRemaining.toString(),
      date: new Date().toISOString().split("T")[0],
      payment_method: "cash",
      treasury_id: defaultTreasury?.id || "",
      notes: "",
    });
    setClientPayDialogOpen(true);
  };

  const handlePrintPaymentReceipt = (payment: any) => {
    openReceiptPrintWindow({
      receiptNumber: `PAY-${payment.id.slice(0, 8)}`,
      date: payment.date,
      type: "payment",
      amount: Number(payment.amount || 0),
      paidToOrBy: supplier?.name || "المورد",
      description: payment.purchases?.title || payment.purchases?.notes || "سداد دفعة مشتريات للمورد",
      projectName: payment.purchases?.projects?.name || undefined,
      notes: payment.notes || undefined,
    }, companySettings);
  };

  // Fetch supplier details
  const { data: supplier, isLoading: supplierLoading } = useQuery({
    queryKey: ["supplier", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch purchases with project and client info
  const { data: purchases, isLoading: purchasesLoading } = useQuery({
    queryKey: ["supplier-purchases", id],
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
        .eq("supplier_id", id!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as Purchase[];
    },
    enabled: !!id,
  });

  // Group purchases by project
  const projectsData = useMemo(() => {
    if (!purchases) return {};
    
    const map: Record<string, {
      project: any;
      client: any;
      projectType: "contracting" | "finishing";
      purchases: any[];
      totalAmount: number;
      paidAmount: number;
      remainingAmount: number;
    }> = {};

    purchases.forEach((p: any) => {
      const proj = p.projects;
      if (!proj) return;
      
      const projId = proj.id;
      const projType = proj.project_type === "finishing" ? "finishing" : "contracting";

      if (!map[projId]) {
        map[projId] = {
          project: proj,
          client: proj.clients,
          projectType: projType,
          purchases: [],
          totalAmount: 0,
          paidAmount: 0,
          remainingAmount: 0,
        };
      }

      map[projId].purchases.push(p);
      const total = Number(p.total_amount || 0);
      const paid = Number((p as any).paid_amount || 0);
      map[projId].totalAmount += total;
      map[projId].paidAmount += paid;
      map[projId].remainingAmount += (total - paid);
    });

    return map;
  }, [purchases]);

  // Overall & Breakdown Stats
  const stats = useMemo(() => {
    let totalPurchases = purchases?.length || 0;
    let totalAmount = 0;
    let paidAmount = 0;
    let contractingTotal = 0;
    let contractingPaid = 0;
    let finishingTotal = 0;
    let finishingPaid = 0;

    purchases?.forEach((p: any) => {
      const amt = Number(p.total_amount || 0);
      const paid = Number((p as any).paid_amount || 0);
      totalAmount += amt;
      paidAmount += paid;

      const isFinishing = p.projects?.project_type === "finishing";
      if (isFinishing) {
        finishingTotal += amt;
        finishingPaid += paid;
      } else {
        contractingTotal += amt;
        contractingPaid += paid;
      }
    });

    return {
      totalPurchases,
      totalAmount,
      paidAmount,
      remainingAmount: totalAmount - paidAmount,
      totalProjects: Object.keys(projectsData).length,
      contractingTotal,
      contractingPaid,
      contractingRemaining: contractingTotal - contractingPaid,
      finishingTotal,
      finishingPaid,
      finishingRemaining: finishingTotal - finishingPaid,
    };
  }, [purchases, projectsData]);

  const handleOpenProjectPayDialog = (projData: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const projType = projData.projectType;
    setDialogProjectType(projType);
    setDialogProjectId(projData.project.id);
    setSelectedPurchaseForPay(null);
    
    const targetParentId = projType === "finishing" 
      ? companySettings?.finishing_treasury_id 
      : companySettings?.contracting_treasury_id;
    const defaultTreasury = treasuries?.find((t: any) => t.parent_id === targetParentId || t.id === targetParentId);

    const remaining = Math.max(0, projData.remainingAmount);

    setPayFormData({
      amount: remaining > 0 ? remaining.toString() : "",
      date: new Date().toISOString().split("T")[0],
      payment_method: "cash",
      treasury_id: defaultTreasury?.id || "",
      commission: "",
      notes: `سداد حساب المورد لمشروع: ${projData.project.name}`,
    });
    setPayDialogOpen(true);
  };

  const handleOpenGeneralPayDialog = () => {
    let defaultType: "contracting" | "finishing" = "contracting";
    if (stats.contractingRemaining <= 0 && stats.finishingRemaining > 0) {
      defaultType = "finishing";
    }

    setDialogProjectType(defaultType);
    setDialogProjectId("");
    setSelectedPurchaseForPay(null);

    const targetParentId = defaultType === "finishing" 
      ? companySettings?.finishing_treasury_id 
      : companySettings?.contracting_treasury_id;
    const defaultTreasury = treasuries?.find((t: any) => t.parent_id === targetParentId || t.id === targetParentId);

    setPayFormData({
      amount: "",
      date: new Date().toISOString().split("T")[0],
      payment_method: "cash",
      treasury_id: defaultTreasury?.id || "",
      commission: "",
      notes: "",
    });
    setPayDialogOpen(true);
  };

  const handleProjectTypeChange = (type: "contracting" | "finishing") => {
    setDialogProjectType(type);
    setDialogProjectId("");
    setSelectedPurchaseForPay(null);

    const targetParentId = type === "finishing" 
      ? companySettings?.finishing_treasury_id 
      : companySettings?.contracting_treasury_id;
    const defaultTreasury = treasuries?.find((t: any) => t.parent_id === targetParentId || t.id === targetParentId);

    setPayFormData(prev => ({
      ...prev,
      amount: "",
      treasury_id: defaultTreasury?.id || "",
    }));
  };

  const handleProjectSelectChange = (projId: string) => {
    setDialogProjectId(projId);
    setSelectedPurchaseForPay(null);

    const projData = projectsData[projId];
    if (projData) {
      const remaining = Math.max(0, projData.remainingAmount);
      setPayFormData(prev => ({
        ...prev,
        amount: remaining > 0 ? remaining.toString() : "",
        notes: `سداد حساب المورد لمشروع: ${projData.project.name}`,
      }));
    } else {
      setPayFormData(prev => ({
        ...prev,
        amount: "",
      }));
    }
  };

  const handlePurchaseSelectChange = (purchaseId: string) => {
    if (!purchaseId) {
      setSelectedPurchaseForPay(null);
      if (dialogProjectId && projectsData[dialogProjectId]) {
        const remaining = Math.max(0, projectsData[dialogProjectId].remainingAmount);
        setPayFormData(prev => ({ ...prev, amount: remaining > 0 ? remaining.toString() : "" }));
      }
      return;
    }

    const purchase = purchases?.find(p => p.id === purchaseId);
    if (purchase) {
      setSelectedPurchaseForPay(purchase);
      const remaining = Math.max(0, Number(purchase.total_amount) - Number((purchase as any).paid_amount || 0));
      setPayFormData(prev => ({
        ...prev,
        amount: remaining.toString(),
        notes: `سداد فاتورة: ${purchase.invoice_number || purchase.title || "مشتريات"}`,
      }));
    }
  };

  if (supplierLoading || purchasesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">المورد غير موجود</p>
        <Link to="/suppliers">
          <Button variant="link">العودة للموردين</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/suppliers" className="hover:text-primary">
          الموردين
        </Link>
        <ArrowRight className="h-4 w-4 rotate-180" />
        <span className={selectedProjectId ? "hover:text-primary cursor-pointer" : "text-foreground"}
          onClick={() => setSelectedProjectId(null)}>
          {supplier.name}
        </span>
        {selectedProjectId && projectsData[selectedProjectId] && (
          <>
            <ArrowRight className="h-4 w-4 rotate-180" />
            <span className="text-foreground">{projectsData[selectedProjectId].project.name}</span>
          </>
        )}
      </div>

      {/* Supplier Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center">
            <Truck className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{supplier.name}</h1>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-muted-foreground">
              {supplier.category && (
                <Badge variant="outline" className="font-semibold">{translateCategory(supplier.category)}</Badge>
              )}
              {supplier.phone && (
                <div className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  <span>{supplier.phone}</span>
                </div>
              )}
              {supplier.email && (
                <div className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  <span>{supplier.email}</span>
                </div>
              )}
            </div>
            {supplier.address && (
              <div className="flex items-center gap-1 text-muted-foreground mt-1">
                <MapPin className="h-4 w-4" />
                <span>{supplier.address}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge className={statusColors[supplier.payment_status || "paid"]}>
            {statusLabels[supplier.payment_status || "paid"]}
          </Badge>
          <Button
            className="gap-2 cursor-pointer mt-1"
            size="sm"
            onClick={handleOpenGeneralPayDialog}
          >
            <Coins className="h-4 w-4" />
            تسجيل دفعة مالية
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">المشتريات</p>
                <p className="text-2xl font-bold">{stats.totalPurchases}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <FolderOpen className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">المشاريع</p>
                <p className="text-2xl font-bold">{stats.totalProjects}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">فواتير المقاولات</p>
                <p className="text-lg font-bold">{formatCurrencyLYD(stats.contractingTotal)}</p>
                <p className="text-[10px] text-destructive">دين: {formatCurrencyLYD(stats.contractingRemaining)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">فواتير التشطيبات</p>
                <p className="text-lg font-bold text-purple-600">{formatCurrencyLYD(stats.finishingTotal)}</p>
                <p className="text-[10px] text-destructive">دين: {formatCurrencyLYD(stats.finishingRemaining)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Wallet className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الدين المستحق</p>
                <p className={`text-lg font-bold ${stats.remainingAmount > 0.01 ? 'text-destructive font-black' : 'text-muted-foreground'}`}>
                  {formatCurrencyLYD(stats.remainingAmount)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Back Button */}
      {selectedProjectId && (
        <Button variant="outline" onClick={() => setSelectedProjectId(null)} className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          رجوع لكافة المشاريع
        </Button>
      )}

      {/* Project Type Tabs & Projects Grid */}
      {!selectedProjectId && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-xl font-bold">المشاريع وحسابات المورد</h2>
            <Tabs dir="rtl" value={projectTypeTab} onValueChange={(val: any) => setProjectTypeTab(val)}>
              <TabsList className="h-10 text-sm">
                <TabsTrigger value="all" className="px-4">
                  الكل ({Object.keys(projectsData).length})
                </TabsTrigger>
                <TabsTrigger value="contracting" className="px-4 gap-1.5">
                  <Settings className="h-3.5 w-3.5 text-blue-600" />
                  مشاريع المقاولات ({Object.values(projectsData).filter((p: any) => p.projectType === "contracting").length})
                </TabsTrigger>
                <TabsTrigger value="finishing" className="px-4 gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                  مشاريع التشطيبات ({Object.values(projectsData).filter((p: any) => p.projectType === "finishing").length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Project Cards Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Object.values(projectsData)
              .filter((p: any) => {
                if (projectTypeTab === "contracting") return p.projectType === "contracting";
                if (projectTypeTab === "finishing") return p.projectType === "finishing";
                return true;
              })
              .map((projData: any) => (
                <Card 
                  key={projData.project.id} 
                  className="p-6 card-hover cursor-pointer transition-all hover:shadow-lg border-2 hover:border-primary/40 relative"
                  onClick={() => setSelectedProjectId(projData.project.id)}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${projData.projectType === 'finishing' ? 'bg-purple-500/10' : 'bg-blue-500/10'}`}>
                          <FolderOpen className={`h-6 w-6 ${projData.projectType === 'finishing' ? 'text-purple-600' : 'text-blue-600'}`} />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold line-clamp-1">{projData.project.name}</h3>
                          {projData.client && (
                            <p className="text-xs text-muted-foreground">الزبون: {projData.client.name}</p>
                          )}
                          <div className="mt-1">
                            <Badge variant="outline" className={projData.projectType === 'finishing' ? 'border-purple-500/30 text-purple-600 bg-purple-50 font-semibold flex items-center gap-1' : 'border-blue-500/30 text-blue-600 bg-blue-50 font-semibold flex items-center gap-1'}>
                              {projData.projectType === 'finishing' ? <><Sparkles className="h-3 w-3 text-purple-600" /> تشطيبات</> : <><Settings className="h-3 w-3 text-blue-600" /> مقاولات</>}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      {projData.remainingAmount > 0.01 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-300 cursor-pointer h-8 text-xs shrink-0 font-semibold"
                          onClick={(e) => handleOpenProjectPayDialog(projData, e)}
                        >
                          <Coins className="h-3.5 w-3.5" />
                          سداد هذا المشروع
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border text-center">
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5">المشتريات</p>
                        <p className="text-sm font-bold text-foreground">{formatCurrencyLYD(projData.totalAmount)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5">المدفوع</p>
                        <p className="text-sm font-bold text-emerald-600">{formatCurrencyLYD(projData.paidAmount)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5">دين المشروع للمورد</p>
                        <p className={`text-sm font-bold ${projData.remainingAmount > 0.01 ? 'text-destructive font-black' : 'text-muted-foreground'}`}>
                          {formatCurrencyLYD(projData.remainingAmount)}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}

            {Object.keys(projectsData).length === 0 && (
              <div className="col-span-full text-center py-12 bg-muted/30 rounded-lg">
                <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">لا توجد مشتريات لهذا المورد في هذا القسم</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selected Project Invoices Table */}
      {selectedProjectId && projectsData[selectedProjectId] && (
        <div className="space-y-4">
          <Card className={`p-4 ${projectsData[selectedProjectId].projectType === 'finishing' ? 'bg-purple-500/5 border-purple-500/20' : 'bg-blue-500/5 border-blue-500/20'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FolderOpen className={`h-6 w-6 ${projectsData[selectedProjectId].projectType === 'finishing' ? 'text-purple-600' : 'text-blue-600'}`} />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold">{projectsData[selectedProjectId].project.name}</h2>
                    <Badge variant="outline" className="flex items-center gap-1">
                      {projectsData[selectedProjectId].projectType === 'finishing' ? <><Sparkles className="h-3 w-3 text-purple-600" /> تشطيبات</> : <><Settings className="h-3 w-3 text-blue-600" /> مقاولات</>}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {projectsData[selectedProjectId].client ? `الزبون: ${projectsData[selectedProjectId].client.name} • ` : ""}
                    {projectsData[selectedProjectId].purchases.length} فاتورة • إجمالي: {formatCurrencyLYD(projectsData[selectedProjectId].totalAmount)}
                  </p>
                </div>
              </div>
              {projectsData[selectedProjectId].remainingAmount > 0.01 && (
                <Button
                  className="gap-2 cursor-pointer bg-emerald-600 hover:bg-emerald-700"
                  size="sm"
                  onClick={(e) => handleOpenProjectPayDialog(projectsData[selectedProjectId], e)}
                >
                  <Coins className="h-4 w-4" />
                  سداد حساب هذا المشروع ({formatCurrencyLYD(projectsData[selectedProjectId].remainingAmount)})
                </Button>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>فواتير المشتريات الخاصة بالمشروع</CardTitle>
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">كل الحالات</option>
                  <option value="paid">مدفوع</option>
                  <option value="due">مستحق</option>
                  <option value="partial">مدفوع جزئياً</option>
                  <option value="processing">قيد المعالجة</option>
                </select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">رقم الفاتورة</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">البنود / الوصف</TableHead>
                    <TableHead className="text-right">المبلغ الإجمالي</TableHead>
                    <TableHead className="text-right">المدفوع</TableHead>
                    <TableHead className="text-right">المتبقي (الدين)</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-center w-24">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectsData[selectedProjectId].purchases
                    .filter((p: Purchase) => statusFilter === "all" || p.status === statusFilter)
                    .map((purchase: Purchase) => {
                      const remaining = Number(purchase.total_amount) - Number((purchase as any).paid_amount || 0);
                      return (
                        <TableRow key={purchase.id}>
                          <TableCell className="font-medium">
                            {purchase.invoice_number || "-"}
                          </TableCell>
                          <TableCell>{purchase.date}</TableCell>
                          <TableCell>
                            {purchase.title || purchase.notes ? (
                              <div className="mb-2 font-medium text-xs text-foreground">
                                {purchase.title || purchase.notes}
                              </div>
                            ) : null}
                            {Array.isArray(purchase.items) && purchase.items.length > 0 ? (
                              <div className="space-y-1">
                                {purchase.items.slice(0, 3).map((item: any, idx: number) => (
                                  <div key={idx} className="text-xs text-muted-foreground">
                                    • {item.name} ({item.qty} × {formatCurrencyLYD(item.price)})
                                  </div>
                                ))}
                                {purchase.items.length > 3 && (
                                  <div className="text-[10px] text-muted-foreground/80 pr-2">
                                    +{purchase.items.length - 3} بنود أخرى
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="font-bold text-foreground">
                            {formatCurrencyLYD(purchase.total_amount)}
                          </TableCell>
                          <TableCell className="font-medium text-emerald-600">
                            {formatCurrencyLYD((purchase as any).paid_amount || 0)}
                          </TableCell>
                          <TableCell className={`font-bold ${remaining > 0.01 ? 'text-destructive font-black' : 'text-muted-foreground'}`}>
                            {formatCurrencyLYD(remaining)}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[purchase.status]}>
                              {statusLabels[purchase.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {purchase.status !== "paid" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedPurchaseForPay(purchase);
                                  setDialogProjectType(projectsData[selectedProjectId].projectType);
                                  setDialogProjectId(selectedProjectId);
                                  
                                  const targetParentId = projectsData[selectedProjectId].projectType === "finishing"
                                    ? companySettings?.finishing_treasury_id 
                                    : companySettings?.contracting_treasury_id;
                                  const defaultTreasury = treasuries?.find((t: any) => t.parent_id === targetParentId || t.id === targetParentId);

                                  setPayFormData({
                                    amount: remaining.toString(),
                                    date: new Date().toISOString().split("T")[0],
                                    payment_method: "cash",
                                    treasury_id: defaultTreasury?.id || "",
                                    commission: "",
                                    notes: `سداد فاتورة: ${purchase.invoice_number || purchase.title || "مشتريات"}`,
                                  });
                                  setPayDialogOpen(true);
                                }}
                                title="تسجيل دفعة مالية للفاتورة"
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
              {projectsData[selectedProjectId].purchases.filter((p: Purchase) => statusFilter === "all" || p.status === statusFilter).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  لا توجد مشتريات بهذه الحالة في هذا المشروع
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Supplier Payments History Log */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>سجل المدفوعات والمسدد للمورد</CardTitle>
          <Badge variant="outline">{payments?.length || 0} دفعة مسجلة</Badge>
        </CardHeader>
        <CardContent>
          {payments && payments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">المشروع / الفاتورة</TableHead>
                  <TableHead className="text-right">الخزينة الصادرة</TableHead>
                  <TableHead className="text-right">طريقة الدفع</TableHead>
                  <TableHead className="text-right">ملاحظات</TableHead>
                  <TableHead className="text-right">المبلغ المدفوع</TableHead>
                  <TableHead className="text-center w-[120px]">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {new Date(payment.date).toLocaleDateString("ar-LY")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          {payment.purchases?.projects?.name || "مشروع عام"}
                        </span>
                        {payment.purchases?.projects?.project_type && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 flex items-center gap-1">
                            {payment.purchases.projects.project_type === "finishing" ? <><Sparkles className="h-2.5 w-2.5 text-purple-600" /> تشطيبات</> : <><Settings className="h-2.5 w-2.5 text-blue-600" /> مقاولات</>}
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {payment.purchases?.title || payment.purchases?.notes || "مشتريات"}
                        {payment.purchases?.invoice_number ? ` (فاتورة: ${payment.purchases.invoice_number})` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-primary">
                      {payment.treasuries?.name || "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {payment.payment_method === "cash" ? "نقداً" : "صك بنكي"}
                      {payment.commission > 0 && ` (عمولة: ${formatCurrencyLYD(payment.commission)})`}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {payment.notes || "—"}
                    </TableCell>
                    <TableCell className="font-bold text-emerald-600">
                      {formatCurrencyLYD(payment.amount)}
                    </TableCell>
                    <TableCell className="text-center flex justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 cursor-pointer h-8 w-8"
                        onClick={() => handleOpenEditPayment(payment)}
                        title="تعديل الدفعة"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 cursor-pointer h-8 w-8"
                        onClick={() => handlePrintPaymentReceipt(payment)}
                        title="طباعة إيصال الصرف"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-red-700 hover:bg-red-50 cursor-pointer h-8 w-8"
                        onClick={() => {
                          if (confirm("هل أنت متأكد من رغبتك في حذف هذه الدفعة وإلغاء أثرها المالي؟")) {
                            deletePaymentMutation.mutate(payment.id);
                          }
                        }}
                        disabled={deletePaymentMutation.isPending}
                        title="حذف الدفعة وإرجاع الرصيد"
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
              لا توجد مدفوعات مسجلة لهذا المورد بعد.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supplier Payment Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>تسجيل دفعة مالية للمورد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 1. Select Project Type */}
            <div className="space-y-2">
              <Label className="font-semibold text-primary">1. اختر نوع المشروع *</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={dialogProjectType === "contracting" ? "default" : "outline"}
                  className="h-10 gap-2 justify-center"
                  onClick={() => handleProjectTypeChange("contracting")}
                >
                  <Settings className="h-4 w-4" />
                  مشاريع المقاولات
                  {stats.contractingRemaining > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      {formatCurrencyLYD(stats.contractingRemaining)}
                    </Badge>
                  )}
                </Button>
                <Button
                  type="button"
                  variant={dialogProjectType === "finishing" ? "default" : "outline"}
                  className="h-10 gap-2 justify-center text-purple-600 border-purple-200"
                  onClick={() => handleProjectTypeChange("finishing")}
                >
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  مشاريع التشطيبات
                  {stats.finishingRemaining > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      {formatCurrencyLYD(stats.finishingRemaining)}
                    </Badge>
                  )}
                </Button>
              </div>
            </div>

            {/* 2. Select Project under chosen Project Type */}
            <div className="space-y-2">
              <Label className="font-semibold text-primary">2. اختر المشروع المراد سداده *</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold"
                value={dialogProjectId}
                onChange={(e) => handleProjectSelectChange(e.target.value)}
              >
                <option value="">اختر المشروع...</option>
                {Object.values(projectsData)
                  .filter((p: any) => p.projectType === dialogProjectType)
                  .map((p: any) => (
                    <option key={p.project.id} value={p.project.id}>
                      {p.project.name} {p.client?.name ? `(${p.client.name})` : ""} - الدين المتبقي: {formatCurrencyLYD(p.remainingAmount)}
                    </option>
                  ))}
              </select>
            </div>

            {/* 3. Optional: Select Specific Purchase/Invoice inside Project */}
            {dialogProjectId && (
              <div className="space-y-2">
                <Label>السداد على فاتورة محددة (اختياري - سداد عام للمشروع افتراضياً)</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedPurchaseForPay?.id || ""}
                  onChange={(e) => handlePurchaseSelectChange(e.target.value)}
                >
                  <option value="">سداد شامل لحساب المشروع ككل</option>
                  {projectsData[dialogProjectId]?.purchases?.map((p: any) => {
                    const rem = Number(p.total_amount) - Number((p as any).paid_amount || 0);
                    return (
                      <option key={p.id} value={p.id}>
                        فاتورة #{p.invoice_number || p.id.slice(0, 6)} - {p.title || p.notes || "مشتريات"} (المتبقي: {formatCurrencyLYD(rem)})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {dialogProjectId && projectsData[dialogProjectId] && (
              <div className="p-3 bg-muted/70 rounded-lg text-xs space-y-1 border">
                <p><strong>المشروع المحدد:</strong> {projectsData[dialogProjectId].project.name}</p>
                {projectsData[dialogProjectId].client && (
                  <p><strong>الزبون:</strong> {projectsData[dialogProjectId].client.name}</p>
                )}
                <p><strong>إجمالي فواتير المشروع:</strong> {formatCurrencyLYD(projectsData[dialogProjectId].totalAmount)}</p>
                <p><strong>المدفوع سابقاً:</strong> {formatCurrencyLYD(projectsData[dialogProjectId].paidAmount)}</p>
                <p className="text-destructive font-bold text-sm pt-1 border-t">
                  دين هذا المشروع للمورد: {formatCurrencyLYD(projectsData[dialogProjectId].remainingAmount)}
                </p>
              </div>
            )}

            {/* 4. Payment Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">المبلغ المراد سداده (د.ل) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="أدخل قيمة الدفعة"
                value={payFormData.amount}
                onChange={(e) => setPayFormData({ ...payFormData, amount: e.target.value })}
              />
            </div>

            {/* 5. Date */}
            <div className="space-y-2">
              <Label htmlFor="date">التاريخ *</Label>
              <Input
                id="date"
                type="date"
                value={payFormData.date}
                onChange={(e) => setPayFormData({ ...payFormData, date: e.target.value })}
              />
            </div>

            {/* 6. Payment Method */}
            <div className="space-y-2">
              <Label htmlFor="payment_method">طريقة الدفع</Label>
              <select
                id="payment_method"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={payFormData.payment_method}
                onChange={(e) => setPayFormData({ ...payFormData, payment_method: e.target.value as any })}
              >
                <option value="cash">نقداً</option>
                <option value="check">صك بنكي</option>
              </select>
            </div>

            {/* 7. Treasury Auto Selected based on project type */}
            <div className="space-y-2">
              <Label htmlFor="treasury_id" className="font-semibold">3. الخزينة / الحساب المصرفي الصادر منه (تتحدد تلقائياً)</Label>
              <select
                id="treasury_id"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold text-primary"
                value={payFormData.treasury_id}
                onChange={(e) => setPayFormData({ ...payFormData, treasury_id: e.target.value })}
              >
                <option value="">اختر الخزينة...</option>
                {treasuries?.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (الرصيد: {formatCurrencyLYD(t.balance || 0)})
                  </option>
                ))}
              </select>
            </div>

            {payFormData.payment_method === "check" && (
              <div className="space-y-2">
                <Label htmlFor="commission">العمولة المصرفية (إن وجدت)</Label>
                <Input
                  id="commission"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={payFormData.commission}
                  onChange={(e) => setPayFormData({ ...payFormData, commission: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">ملاحظات</Label>
              <Input
                id="notes"
                placeholder="أدخل أي ملاحظات إضافية"
                value={payFormData.notes}
                onChange={(e) => setPayFormData({ ...payFormData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setPayDialogOpen(false)}
              disabled={payMutation.isPending}
            >
              إلغاء
            </Button>
            <Button
              onClick={() => payMutation.mutate(payFormData)}
              disabled={payMutation.isPending || !payFormData.amount || !payFormData.treasury_id}
            >
              {payMutation.isPending ? "جاري الحفظ..." : "تسجيل الدفعة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Client On-Account Payment Dialog */}
      <Dialog open={clientPayDialogOpen} onOpenChange={setClientPayDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>تسجيل دفعة على الحساب للزبون {selectedClientForPay?.client?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedClientForPay && (
              <div className="p-3 bg-muted rounded-lg text-xs space-y-1">
                <p><strong>الزبون:</strong> {selectedClientForPay.client.name}</p>
                <p><strong>إجمالي المشتريات:</strong> {formatCurrencyLYD(selectedClientForPay.totalAmount)}</p>
                <p><strong>المدفوع سابقاً:</strong> {formatCurrencyLYD(selectedClientForPay.paidAmount)}</p>
                <p className="text-destructive"><strong>المتبقي المستحق:</strong> {formatCurrencyLYD(selectedClientForPay.totalAmount - selectedClientForPay.paidAmount)}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="client_pay_amount">المبلغ المدفوع (د.ل)</Label>
              <Input
                id="client_pay_amount"
                type="number"
                step="0.01"
                placeholder="أدخل قيمة الدفعة"
                value={clientPayFormData.amount}
                onChange={(e) => setClientPayFormData({ ...clientPayFormData, amount: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client_pay_date">التاريخ</Label>
              <Input
                id="client_pay_date"
                type="date"
                value={clientPayFormData.date}
                onChange={(e) => setClientPayFormData({ ...clientPayFormData, date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client_pay_method">طريقة الدفع</Label>
              <select
                id="client_pay_method"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={clientPayFormData.payment_method}
                onChange={(e) => setClientPayFormData({ ...clientPayFormData, payment_method: e.target.value as any })}
              >
                <option value="cash">نقداً</option>
                <option value="check">صك بنكي</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="client_pay_treasury">الخزينة الصادر منها</Label>
              <select
                id="client_pay_treasury"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold text-primary"
                value={clientPayFormData.treasury_id}
                onChange={(e) => setClientPayFormData({ ...clientPayFormData, treasury_id: e.target.value })}
              >
                <option value="">اختر الخزينة...</option>
                {treasuries
                  ?.filter((t: any) => 
                    t.parent_id === companySettings?.finishing_treasury_id || 
                    t.id === companySettings?.finishing_treasury_id ||
                    t.parent_id === companySettings?.contracting_treasury_id || 
                    t.id === companySettings?.contracting_treasury_id
                  )
                  ?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (الرصيد: {formatCurrencyLYD(t.balance || 0)})
                    </option>
                  ))
                }
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="client_pay_notes">ملاحظات</Label>
              <Input
                id="client_pay_notes"
                placeholder="أدخل ملاحظات اختيارية"
                value={clientPayFormData.notes}
                onChange={(e) => setClientPayFormData({ ...clientPayFormData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setClientPayDialogOpen(false)}
              disabled={clientPayMutation.isPending}
            >
              إلغاء
            </Button>
            <Button
              onClick={() => clientPayMutation.mutate(clientPayFormData)}
              disabled={clientPayMutation.isPending || !clientPayFormData.amount || !clientPayFormData.treasury_id}
            >
              {clientPayMutation.isPending ? "جاري تسجيل الدفعة..." : "تسجيل الدفعة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Supplier Payment Dialog */}
      <Dialog open={editPayDialogOpen} onOpenChange={setEditPayDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل بيانات الدفعة المالية للمورد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit_pay_amount">المبلغ المدفوع (د.ل) *</Label>
              <Input
                id="edit_pay_amount"
                type="number"
                step="0.001"
                placeholder="أدخل المبلغ"
                value={editPayFormData.amount}
                onChange={(e) => setEditPayFormData({ ...editPayFormData, amount: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_pay_date">تاريخ الدفعة *</Label>
              <Input
                id="edit_pay_date"
                type="date"
                value={editPayFormData.date}
                onChange={(e) => setEditPayFormData({ ...editPayFormData, date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_pay_method">طريقة الدفع *</Label>
              <select
                id="edit_pay_method"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={editPayFormData.payment_method}
                onChange={(e) => setEditPayFormData({ ...editPayFormData, payment_method: e.target.value })}
              >
                <option value="cash">نقداً (كاش)</option>
                <option value="check">صك بنكي (شيك)</option>
                <option value="transfer">تحويل بنكي</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_pay_treasury">الخزينة الصادرة *</Label>
              <select
                id="edit_pay_treasury"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={editPayFormData.treasury_id}
                onChange={(e) => setEditPayFormData({ ...editPayFormData, treasury_id: e.target.value })}
              >
                <option value="">اختر الخزينة...</option>
                {treasuries?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (الرصيد: {formatCurrencyLYD(t.balance || 0)})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_pay_commission">العمولة (إن وجدت)</Label>
              <Input
                id="edit_pay_commission"
                type="number"
                step="0.001"
                placeholder="0.000"
                value={editPayFormData.commission}
                onChange={(e) => setEditPayFormData({ ...editPayFormData, commission: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_pay_notes">ملاحظات</Label>
              <Input
                id="edit_pay_notes"
                placeholder="أدخل ملاحظات اختياري"
                value={editPayFormData.notes}
                onChange={(e) => setEditPayFormData({ ...editPayFormData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setEditPayDialogOpen(false)}
              disabled={updatePaymentMutation.isPending}
            >
              إلغاء
            </Button>
            <Button
              onClick={() => updatePaymentMutation.mutate(editPayFormData)}
              disabled={updatePaymentMutation.isPending || !editPayFormData.amount || !editPayFormData.treasury_id}
            >
              {updatePaymentMutation.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupplierDetail;
