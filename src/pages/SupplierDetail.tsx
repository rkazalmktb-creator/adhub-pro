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
  Trash2
} from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";
import { openReceiptPrintWindow } from "@/lib/printStyles";
import { useState } from "react";
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
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [dialogClientId, setDialogClientId] = useState<string>("");
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
      } else if (dialogClientId) {
        const clientProjects = Object.values(clientsData[dialogClientId].projects).map((p: any) => p.project.id);
        
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
              notes: data.notes || `دفعة للحساب - زبون: ${clientsData[dialogClientId].client.name}`,
            });

          if (error) throw error;
          remainingPayment -= amountToPay;
        }
      } else {
        throw new Error("يرجى اختيار زبون لتسجيل الدفعة");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-purchases", id] });
      queryClient.invalidateQueries({ queryKey: ["supplier-payments-list", id] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      toast({ title: "تم تسجيل الدفعة للمورد بنجاح ✨" });
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
      toast({ title: "تم حذف الدفعة وإعادة رصيد الخزينة بنجاح 🗑️" });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ أثناء الحذف",
        description: error.message || "حدث خطأ غير متوقع",
        variant: "destructive"
      });
    }
  });
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
      toast({ title: "تم تسجيل وتوزيع الدفعة على الحساب بنجاح 🎉" });
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

  // Group purchases by client
  const clientsData = purchases?.reduce((acc, purchase) => {
    const client = purchase.projects?.clients;
    if (!client) return acc;
    
    if (!acc[client.id]) {
      acc[client.id] = {
        client,
        projects: {},
        totalAmount: 0,
        paidAmount: 0,
        purchaseCount: 0,
      };
    }
    
    const project = purchase.projects;
    if (project) {
      if (!acc[client.id].projects[project.id]) {
        acc[client.id].projects[project.id] = {
          project,
          purchases: [],
          totalAmount: 0,
          paidAmount: 0,
        };
      }
      acc[client.id].projects[project.id].purchases.push(purchase);
      acc[client.id].projects[project.id].totalAmount += Number(purchase.total_amount);
      acc[client.id].projects[project.id].paidAmount += Number((purchase as any).paid_amount || 0);
    }
    
    acc[client.id].totalAmount += Number(purchase.total_amount);
    acc[client.id].paidAmount += Number((purchase as any).paid_amount || 0);
    acc[client.id].purchaseCount++;
    return acc;
  }, {} as Record<string, any>) || {};

  // Get selected client data
  const selectedClientData = selectedClientId ? clientsData[selectedClientId] : null;
  
  // Get selected project purchases
  const selectedProjectData = selectedClientData && selectedProjectId 
    ? selectedClientData.projects[selectedProjectId] 
    : null;

  // Statistics
  const stats = {
    totalPurchases: purchases?.length || 0,
    totalAmount: purchases?.reduce((sum, p) => sum + Number(p.total_amount), 0) || 0,
    totalClients: Object.keys(clientsData).length,
    totalProjects: Object.values(clientsData).reduce((sum: number, c: any) => sum + Object.keys(c.projects).length, 0),
    paidAmount: purchases?.reduce((sum, p) => sum + Number((p as any).paid_amount || 0), 0) || 0,
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

  // Handle back navigation in hierarchy
  const handleBack = () => {
    if (selectedProjectId) {
      setSelectedProjectId(null);
    } else if (selectedClientId) {
      setSelectedClientId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/suppliers" className="hover:text-primary">
          الموردين
        </Link>
        <ArrowRight className="h-4 w-4 rotate-180" />
        <span className={selectedClientId ? "hover:text-primary cursor-pointer" : "text-foreground"}
          onClick={() => { setSelectedClientId(null); setSelectedProjectId(null); }}>
          {supplier.name}
        </span>
        {selectedClientId && (
          <>
            <ArrowRight className="h-4 w-4 rotate-180" />
            <span 
              className={selectedProjectId ? "hover:text-primary cursor-pointer" : "text-foreground"}
              onClick={() => setSelectedProjectId(null)}
            >
              {selectedClientData?.client.name}
            </span>
          </>
        )}
        {selectedProjectId && (
          <>
            <ArrowRight className="h-4 w-4 rotate-180" />
            <span className="text-foreground">{selectedProjectData?.project.name}</span>
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
            onClick={() => {
              const firstUnpaid = purchases?.find(p => p.status !== 'paid');
              if (firstUnpaid) {
                handleOpenPayDialog(firstUnpaid);
              } else if (purchases && purchases.length > 0) {
                handleOpenPayDialog(purchases[0]);
              } else {
                toast({ 
                  title: "تنبيه", 
                  description: "لا توجد فواتير أو مشتريات مسجلة لهذا المورد للدفع عليها.",
                  variant: "destructive"
                });
              }
            }}
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
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Building className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">العملاء</p>
                <p className="text-2xl font-bold">{stats.totalClients}</p>
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
              <div className="p-2 bg-green-500/10 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">الإجمالي</p>
                <p className="text-lg font-bold">{formatCurrencyLYD(stats.totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">المدفوع</p>
                <p className="text-lg font-bold">{formatCurrencyLYD(stats.paidAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Back Button */}
      {(selectedClientId || selectedProjectId) && (
        <Button variant="outline" onClick={handleBack} className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          رجوع
        </Button>
      )}

      {/* Level 1: Clients List */}
      {!selectedClientId && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Object.values(clientsData).map((clientData: any) => (
            <Card 
              key={clientData.client.id} 
              className="p-6 card-hover cursor-pointer transition-all hover:shadow-lg"
              onClick={() => setSelectedClientId(clientData.client.id)}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <Building className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{clientData.client.name}</h3>
                      {clientData.client.phone && (
                        <p className="text-sm text-muted-foreground">{clientData.client.phone}</p>
                      )}
                    </div>
                  </div>
                  {clientData.totalAmount - clientData.paidAmount > 0.01 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenClientPayDialog(clientData);
                      }}
                    >
                      <Coins className="h-3 w-3" />
                      دفعة للحساب
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <FolderOpen className="h-3 w-3 text-orange-500" />
                      <span className="text-xl font-bold text-orange-500">{Object.keys(clientData.projects).length}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">مشروع</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <ShoppingCart className="h-3 w-3 text-green-500" />
                      <span className="text-xl font-bold text-green-500">{clientData.purchaseCount}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">فاتورة</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border text-center">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">المشتريات</p>
                    <p className="text-sm font-bold text-foreground">{formatCurrencyLYD(clientData.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">المدفوع</p>
                    <p className="text-sm font-bold text-emerald-600">{formatCurrencyLYD(clientData.paidAmount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">المتبقي</p>
                    <p className={`text-sm font-bold ${clientData.totalAmount - clientData.paidAmount > 0.01 ? 'text-destructive font-black' : 'text-muted-foreground'}`}>
                      {formatCurrencyLYD(clientData.totalAmount - clientData.paidAmount)}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          ))}

          {Object.keys(clientsData).length === 0 && (
            <div className="col-span-full text-center py-12 bg-muted/30 rounded-lg">
              <Building className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">لا توجد مشتريات لهذا المورد</p>
            </div>
          )}
        </div>
      )}

      {/* Level 2: Projects for Selected Client */}
      {selectedClientId && !selectedProjectId && selectedClientData && (
        <div className="space-y-4">
          <Card className="p-4 bg-blue-500/5 border-blue-500/20">
            <div className="flex items-center gap-3">
              <Building className="h-6 w-6 text-blue-500" />
              <div>
                <h2 className="text-xl font-bold">{selectedClientData.client.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {Object.keys(selectedClientData.projects).length} مشروع • {selectedClientData.purchaseCount} فاتورة • {formatCurrencyLYD(selectedClientData.totalAmount)}
                </p>
              </div>
            </div>
          </Card>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Object.values(selectedClientData.projects).map((projectData: any) => (
              <Card 
                key={projectData.project.id} 
                className="p-6 card-hover cursor-pointer transition-all hover:shadow-lg"
                onClick={() => setSelectedProjectId(projectData.project.id)}
              >
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                      <FolderOpen className="h-6 w-6 text-orange-500" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{projectData.project.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {projectData.purchases.length} فاتورة
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border text-center">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">المشتريات</p>
                      <p className="text-sm font-bold text-foreground">{formatCurrencyLYD(projectData.totalAmount)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">المدفوع</p>
                      <p className="text-sm font-bold text-emerald-600">{formatCurrencyLYD(projectData.paidAmount)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">المتبقي</p>
                      <p className={`text-sm font-bold ${projectData.totalAmount - projectData.paidAmount > 0.01 ? 'text-destructive font-black' : 'text-muted-foreground'}`}>
                        {formatCurrencyLYD(projectData.totalAmount - projectData.paidAmount)}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Level 3: Purchases for Selected Project */}
      {selectedProjectId && selectedProjectData && (
        <div className="space-y-4">
          <Card className="p-4 bg-orange-500/5 border-orange-500/20">
            <div className="flex items-center gap-3">
              <FolderOpen className="h-6 w-6 text-orange-500" />
              <div>
                <h2 className="text-xl font-bold">{selectedProjectData.project.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedProjectData.purchases.length} فاتورة • {formatCurrencyLYD(selectedProjectData.totalAmount)}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>المشتريات</CardTitle>
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
                    <TableHead className="text-right">المتبقي</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-center w-24">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedProjectData.purchases
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
                                onClick={() => handleOpenPayDialog(purchase)}
                                title="تسجيل دفعة مالية للمورد"
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
              {selectedProjectData.purchases.filter((p: Purchase) => statusFilter === "all" || p.status === statusFilter).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  لا توجد مشتريات بهذه الحالة
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
                      <div className="text-xs font-semibold text-foreground">
                        {payment.purchases?.title || payment.purchases?.notes || "مشتريات"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        مشروع: {payment.purchases?.projects?.name || "—"} &nbsp;|&nbsp; الفاتورة: {payment.purchases?.invoice_number || "—"}
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
        <DialogContent className="sm:max-w-[425px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>تسجيل دفعة مالية للمورد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 1. Client Select */}
            <div className="space-y-2">
              <Label>الزبون المستهدف بالسداد</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold text-primary"
                value={dialogClientId}
                onChange={(e) => {
                  const val = e.target.value;
                  setDialogClientId(val);
                  setDialogProjectId("");
                  setSelectedPurchaseForPay(null);
                  setPayFormData(prev => ({ ...prev, amount: "", treasury_id: "" }));
                }}
              >
                <option value="">اختر الزبون...</option>
                {Object.values(clientsData).map((c: any) => (
                  <option key={c.client.id} value={c.client.id}>
                    {c.client.name} (المتبقي: {formatCurrencyLYD(c.totalAmount - c.paidAmount)})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Project Select */}
            <div className="space-y-2">
              <Label>المشروع</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold"
                value={dialogProjectId}
                onChange={(e) => {
                  const val = e.target.value;
                  setDialogProjectId(val);
                  setSelectedPurchaseForPay(null);
                  setPayFormData(prev => ({ ...prev, amount: "", treasury_id: "" }));
                }}
                disabled={!dialogClientId}
              >
                <option value="">اختر المشروع...</option>
                {dialogClientId && clientsData[dialogClientId] && 
                  Object.values(clientsData[dialogClientId].projects).map((p: any) => (
                    <option key={p.project.id} value={p.project.id}>
                      {p.project.name} (المتبقي: {formatCurrencyLYD(p.totalAmount - p.paidAmount)})
                    </option>
                  ))
                }
              </select>
            </div>

            {/* 3. Purchase/Invoice Select */}
            <div className="space-y-2">
              <Label>الفاتورة المعنية بالسداد</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold text-primary"
                value={selectedPurchaseForPay?.id || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  const purchase = purchases?.find(p => p.id === val);
                  if (purchase) {
                    setSelectedPurchaseForPay(purchase);
                    const remaining = Number(purchase.total_amount) - Number(purchase.paid_amount || 0);
                    
                    const isFinishing = purchase.projects?.project_type === "finishing";
                    const targetParentId = isFinishing 
                      ? companySettings?.finishing_treasury_id 
                      : companySettings?.contracting_treasury_id;
                    const defaultTreasury = treasuries?.find((t: any) => t.parent_id === targetParentId || t.id === targetParentId);
                    
                    setPayFormData(prev => ({
                      ...prev,
                      amount: remaining.toString(),
                      treasury_id: defaultTreasury?.id || purchase.treasury_id || "",
                    }));
                  } else {
                    setSelectedPurchaseForPay(null);
                    setPayFormData(prev => ({ ...prev, amount: "", treasury_id: "" }));
                  }
                }}
                disabled={!dialogProjectId}
              >
                <option value="">اختر الفاتورة المعنية...</option>
                {dialogProjectId && dialogClientId && clientsData[dialogClientId]?.projects[dialogProjectId] &&
                  clientsData[dialogClientId].projects[dialogProjectId].purchases
                    .map((p: any) => {
                      const rem = Number(p.total_amount) - Number(p.paid_amount || 0);
                      return (
                        <option key={p.id} value={p.id}>
                          {p.title || p.notes || "مشتريات"} - المتبقي: {formatCurrencyLYD(rem)} {p.status === "paid" ? "(مدفوع)" : ""}
                        </option>
                      );
                    })
                }
              </select>
            </div>

            {selectedPurchaseForPay && (
              <div className="p-3 bg-muted rounded-lg text-xs space-y-1">
                <p><strong>المشترك / الفاتورة:</strong> {selectedPurchaseForPay.title || selectedPurchaseForPay.notes || "مشتريات خدمات ومواد"}</p>
                <p><strong>المبلغ الإجمالي:</strong> {formatCurrencyLYD(selectedPurchaseForPay.total_amount)}</p>
                <p><strong>المدفوع سابقاً:</strong> {formatCurrencyLYD(selectedPurchaseForPay.paid_amount || 0)}</p>
                <p className="text-destructive"><strong>المتبقي المستحق:</strong> {formatCurrencyLYD(Number(selectedPurchaseForPay.total_amount) - Number(selectedPurchaseForPay.paid_amount || 0))}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="amount">المبلغ المدفوع (د.ل)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="أدخل قيمة الدفعة"
                value={payFormData.amount}
                onChange={(e) => setPayFormData({ ...payFormData, amount: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">التاريخ</Label>
              <Input
                id="date"
                type="date"
                value={payFormData.date}
                onChange={(e) => setPayFormData({ ...payFormData, date: e.target.value })}
              />
            </div>

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

            <div className="space-y-2">
              <Label htmlFor="treasury_id">الخزينة / الحساب المصرفي الصادر منه (محددة بناءً على نوع المشروع)</Label>
              <select
                id="treasury_id"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold text-primary"
                value={payFormData.treasury_id}
                onChange={(e) => setPayFormData({ ...payFormData, treasury_id: e.target.value })}
              >
                <option value="">اختر الخزينة...</option>
                {(() => {
                  const isFinishing = selectedPurchaseForPay?.projects?.project_type === "finishing";
                  const hasPurchase = !!selectedPurchaseForPay;
                  const targetParentId = isFinishing 
                    ? companySettings?.finishing_treasury_id 
                    : companySettings?.contracting_treasury_id;
                  
                  return treasuries
                    ?.filter((t: any) => {
                      if (hasPurchase) {
                        return t.parent_id === targetParentId || t.id === targetParentId;
                      }
                      return t.parent_id === companySettings?.finishing_treasury_id || 
                             t.id === companySettings?.finishing_treasury_id ||
                             t.parent_id === companySettings?.contracting_treasury_id || 
                             t.id === companySettings?.contracting_treasury_id;
                    })
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
    </div>
  );
};

export default SupplierDetail;
