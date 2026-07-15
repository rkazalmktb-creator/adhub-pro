import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Plus, Pencil, Trash2, Wallet, Save, X, Landmark, FolderOpen, ArrowLeftRight, Banknote, Calendar, ShieldAlert, CreditCard } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatCurrencyLYD } from "@/lib/currency";
import { useNavigate } from "react-router-dom";

interface Treasury {
  id: string;
  name: string;
  description: string | null;
  balance: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  treasury_type: string;
  bank_name: string | null;
  account_number: string | null;
  parent_id: string | null;
}

const Treasuries = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Treasury | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<"parent" | "child">("parent");
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    fromTreasuryId: "",
    toTreasuryId: "",
    amount: 0,
    reason: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_active: true,
    notes: "",
    treasury_type: "cash",
    bank_name: "",
    account_number: "",
  });

  // Fetch treasuries
  const { data: treasuries, isLoading: isLoadingTreasuries } = useQuery({
    queryKey: ["treasuries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasuries")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data as Treasury[];
    },
  });

  // Fetch transfers (loans & custodies)
  const { data: transfers, isLoading: isLoadingTransfers } = useQuery({
    queryKey: ["transfers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transfers")
        .select("*, projects(name)")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [activeTab, setActiveTab] = useState<"accounts" | "loans">("accounts");

  const isLoading = isLoadingTreasuries || isLoadingTransfers;

  // Group: parents and children
  const parentTreasuries = treasuries?.filter(t => !t.parent_id) || [];
  const childTreasuries = treasuries?.filter(t => t.parent_id) || [];
  const getChildren = (parentId: string) => treasuries?.filter(t => t.parent_id === parentId) || [];

  // Stats
  const totalCashBalance = childTreasuries.filter(t => t.treasury_type === "cash" && t.is_active).reduce((sum, t) => sum + t.balance, 0);
  const totalBankBalance = childTreasuries.filter(t => t.treasury_type === "bank" && t.is_active).reduce((sum, t) => sum + t.balance, 0);
  
  const activeLoans = transfers?.filter(t => t.type === "loan" && t.status === "active") || [];
  const totalActiveLoans = activeLoans.reduce((sum, t) => sum + Number(t.amount), 0);

  const activeAdvances = transfers?.filter(t => t.type === "advance" && t.status === "active") || [];
  const totalActiveAdvances = activeAdvances.reduce((sum, t) => sum + Number(t.amount), 0);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { parent_id?: string | null }) => {
      const payload: any = {
        name: data.name,
        description: data.description || null,
        is_active: data.is_active,
        notes: data.notes || null,
        treasury_type: data.treasury_type,
        bank_name: data.treasury_type === "bank" ? (data.bank_name || null) : null,
        account_number: data.treasury_type === "bank" ? (data.account_number || null) : null,
        parent_id: data.parent_id || null,
      };
      if (editing) {
        const { error } = await supabase.from("treasuries").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("treasuries").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      toast({ title: editing ? "تم تحديث البيانات" : "تمت الإضافة بنجاح" });
      handleClose();
    },
    onError: () => {
      toast({ title: "خطأ", description: "حدث خطأ أثناء الحفظ", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("treasuries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      toast({ title: "تم الحذف بنجاح" });
      setDeleteId(null);
    },
    onError: () => {
      toast({ title: "خطأ", description: "لا يمكن الحذف - قد تكون مرتبطة بعمليات", variant: "destructive" });
    },
  });

  const transferMutation = useMutation({
    mutationFn: async (form: typeof transferForm) => {
      const fromTreasury = treasuries?.find(t => t.id === form.fromTreasuryId);
      const toTreasury = treasuries?.find(t => t.id === form.toTreasuryId);
      if (!fromTreasury || !toTreasury) throw new Error("خزينة غير موجودة");
      if (fromTreasury.balance < form.amount) throw new Error("الرصيد غير كافٍ");

      const newFromBalance = fromTreasury.balance - form.amount;
      const newToBalance = toTreasury.balance + form.amount;
      const description = `نقل إلى ${toTreasury.name}`;
      const descriptionTo = `نقل من ${fromTreasury.name}`;

      // Withdrawal from source
      const { error: e1 } = await supabase.from("treasury_transactions").insert([{
        treasury_id: form.fromTreasuryId,
        type: "withdrawal",
        amount: form.amount,
        balance_after: newFromBalance,
        source: "transfer",
        source_details: form.reason || null,
        description,
        date: form.date,
        notes: form.reason || null,
        reference_type: "transfer",
        reference_id: form.toTreasuryId,
      }]);
      if (e1) throw e1;

      // Deposit to destination
      const { error: e2 } = await supabase.from("treasury_transactions").insert([{
        treasury_id: form.toTreasuryId,
        type: "deposit",
        amount: form.amount,
        balance_after: newToBalance,
        source: "transfer",
        source_details: form.reason || null,
        description: descriptionTo,
        date: form.date,
        notes: form.reason || null,
        reference_type: "transfer",
        reference_id: form.fromTreasuryId,
      }]);
      if (e2) throw e2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      toast({ title: "تم نقل المبلغ بنجاح" });
      setTransferDialogOpen(false);
      setTransferForm({ fromTreasuryId: "", toTreasuryId: "", amount: 0, reason: "", date: new Date().toISOString().split("T")[0] });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message || "حدث خطأ أثناء النقل", variant: "destructive" });
    },
  });

  const handleClose = () => {
    setDialogOpen(false);
    setEditing(null);
    setDialogMode("parent");
    setSelectedParentId(null);
    setFormData({ name: "", description: "", is_active: true, notes: "", treasury_type: "cash", bank_name: "", account_number: "" });
  };

  const handleAddParent = () => {
    setDialogMode("parent");
    setSelectedParentId(null);
    setFormData({ ...formData, treasury_type: "cash" });
    setDialogOpen(true);
  };

  const handleAddChild = (parentId: string) => {
    setDialogMode("child");
    setSelectedParentId(parentId);
    setFormData({ name: "", description: "", is_active: true, notes: "", treasury_type: "cash", bank_name: "", account_number: "" });
    setDialogOpen(true);
  };

  const handleEdit = (t: Treasury) => {
    setEditing(t);
    setDialogMode(t.parent_id ? "child" : "parent");
    setSelectedParentId(t.parent_id);
    setFormData({
      name: t.name,
      description: t.description || "",
      is_active: t.is_active,
      notes: t.notes || "",
      treasury_type: t.treasury_type || "cash",
      bank_name: t.bank_name || "",
      account_number: t.account_number || "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال الاسم", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      ...formData,
      parent_id: dialogMode === "child" ? selectedParentId : null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Upper Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">إدارة الحسابات والخزائن</h1>
            <p className="text-sm text-muted-foreground">مراقبة السيولة النقدية، الحسابات المصرفية، السلف، والتحويلات</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setTransferDialogOpen(true)} disabled={childTreasuries.length < 2} className="rounded-xl h-10 border-amber-500/20 hover:bg-amber-500/5 hover:text-amber-600">
            <ArrowLeftRight className="h-4 w-4 ml-2" />
            نقل بين الخزائن
          </Button>
          <Button onClick={handleAddParent} className="rounded-xl h-10 bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-md shadow-amber-600/10">
            <Plus className="h-4 w-4 ml-2" />
            إضافة خزينة رئيسية
          </Button>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Cash */}
        <Card className="border border-border/40 bg-gradient-to-br from-amber-500/[0.03] to-transparent hover:border-amber-500/20 transition-all duration-300 rounded-2xl overflow-hidden shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">السيولة النقدية (كاش)</span>
              <p className="text-2xl font-bold tracking-tight text-amber-700 dark:text-amber-400">{formatCurrencyLYD(totalCashBalance)}</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Wallet className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Bank */}
        <Card className="border border-border/40 bg-gradient-to-br from-blue-500/[0.03] to-transparent hover:border-blue-500/20 transition-all duration-300 rounded-2xl overflow-hidden shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">الحسابات المصرفية</span>
              <p className="text-2xl font-bold tracking-tight text-blue-700 dark:text-blue-400">{formatCurrencyLYD(totalBankBalance)}</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Landmark className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Loans */}
        <Card 
          onClick={() => setActiveTab("loans")}
          className="border border-border/40 bg-gradient-to-br from-rose-500/[0.03] to-transparent hover:border-rose-500/20 cursor-pointer transition-all duration-300 rounded-2xl overflow-hidden shadow-sm hover:shadow-md"
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">إجمالي السلف المعلقة</span>
              <p className="text-2xl font-bold tracking-tight text-rose-700 dark:text-rose-400">{formatCurrencyLYD(totalActiveLoans)}</p>
            </div>
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Banknote className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Custodies */}
        <Card 
          onClick={() => navigate("/transfers")}
          className="border border-border/40 bg-gradient-to-br from-purple-500/[0.03] to-transparent hover:border-purple-500/20 cursor-pointer transition-all duration-300 rounded-2xl overflow-hidden shadow-sm hover:shadow-md"
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">العهد والمصاريف النشطة</span>
              <p className="text-2xl font-bold tracking-tight text-purple-700 dark:text-purple-400">{formatCurrencyLYD(totalActiveAdvances)}</p>
            </div>
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <CreditCard className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Styled Custom Tab Bar */}
      <div className="flex border-b border-border/60 pb-px">
        <button
          onClick={() => setActiveTab("accounts")}
          className={`pb-3 px-6 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "accounts"
              ? "border-amber-500 text-amber-600 dark:text-amber-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          الخزائن والحسابات المصرفية ({parentTreasuries.length})
        </button>
        <button
          onClick={() => setActiveTab("loans")}
          className={`pb-3 px-6 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "loans"
              ? "border-amber-500 text-amber-600 dark:text-amber-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          السلف والعهد المعلقة ({activeLoans.length + activeAdvances.length})
        </button>
      </div>

      {/* Tab Content 1: Accounts */}
      {activeTab === "accounts" && (
        <div className="space-y-6">
          {parentTreasuries.length === 0 ? (
            <Card className="p-12 text-center border-dashed rounded-2xl">
              <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">لا توجد خزائن رئيسية</h3>
              <p className="text-sm text-muted-foreground mb-4">ابدأ بإضافة أول خزينة رئيسية لتنظيم فروعك وحساباتك المصرفية</p>
              <Button onClick={handleAddParent} className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl">
                <Plus className="h-4 w-4 ml-2" />
                إضافة خزينة
              </Button>
            </Card>
          ) : (
            <div className="grid gap-6">
              {parentTreasuries.map((parent) => {
                const children = getChildren(parent.id);
                const totalBalance = children.reduce((sum, c) => sum + c.balance, 0);

                return (
                  <Card key={parent.id} className={`border border-border/50 shadow-sm rounded-2xl overflow-hidden transition-all hover:border-amber-500/10 ${!parent.is_active ? "opacity-60" : ""}`}>
                    <CardHeader className="flex flex-row items-center justify-between pb-4 bg-muted/20 border-b border-border/30">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                          <FolderOpen className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-bold flex items-center gap-2">
                            {parent.name}
                            {!parent.is_active && <Badge variant="secondary" className="text-[10px] px-1.5 h-4">معطلة</Badge>}
                          </CardTitle>
                          {parent.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{parent.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-left">
                          <span className="text-xs text-muted-foreground block">الرصيد الإجمالي</span>
                          <span className="text-base font-extrabold text-amber-700 dark:text-amber-400">{formatCurrencyLYD(totalBalance)}</span>
                        </div>
                        <div className="flex items-center gap-1 border-r border-border/40 pr-3">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(parent)} className="h-8 w-8 hover:bg-amber-500/5 hover:text-amber-600">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(parent.id)} className="h-8 w-8 hover:bg-red-500/5 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-5">
                      {children.length === 0 ? (
                        <div className="p-8 text-center border-2 border-dashed border-muted rounded-xl">
                          <p className="text-xs text-muted-foreground mb-3">لا توجد فروع أو حسابات تحت هذه الخزينة</p>
                          <Button variant="outline" size="sm" onClick={() => handleAddChild(parent.id)} className="rounded-lg h-8 border-amber-500/20 hover:bg-amber-500/5">
                            <Plus className="h-3 w-3 ml-1.5" />
                            إضافة فرع / حساب بنكي
                          </Button>
                        </div>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {children.map((child) => (
                            <div
                              key={child.id}
                              className={`group relative flex flex-col justify-between p-4 rounded-xl border border-border/40 hover:border-amber-500/30 hover:shadow-md bg-card transition-all cursor-pointer ${!child.is_active ? "opacity-60" : ""}`}
                              onClick={() => navigate(`/treasuries/${child.id}`)}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <div className={`p-2 rounded-lg ${child.treasury_type === "bank" ? "bg-blue-500/10 text-blue-600" : "bg-amber-500/10 text-amber-600"}`}>
                                    {child.treasury_type === "bank" ? (
                                      <Landmark className="h-4 w-4" />
                                    ) : (
                                      <Wallet className="h-4 w-4" />
                                    )}
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-sm group-hover:text-amber-600 transition-colors">{child.name}</h4>
                                    {child.treasury_type === "bank" && child.bank_name && (
                                      <span className="text-[10px] text-muted-foreground block">{child.bank_name}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-amber-500/5 hover:text-amber-600" onClick={(e) => { e.stopPropagation(); handleEdit(child); }}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-red-500/5 hover:text-red-600" onClick={(e) => { e.stopPropagation(); setDeleteId(child.id); }}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                              
                              {child.treasury_type === "bank" && child.account_number && (
                                <p className="text-[11px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded mb-3 self-start">
                                  {child.account_number}
                                </p>
                              )}

                              <div className="flex items-end justify-between mt-1">
                                <div>
                                  <span className="text-[10px] text-muted-foreground block">الرصيد الحالي</span>
                                  <span className="text-base font-extrabold text-amber-700 dark:text-amber-400">{formatCurrencyLYD(child.balance)}</span>
                                </div>
                                <Badge variant="outline" className={`text-[10px] ${child.treasury_type === "bank" ? "border-blue-500/20 text-blue-600 bg-blue-500/5" : "border-amber-500/20 text-amber-600 bg-amber-500/5"}`}>
                                  {child.treasury_type === "bank" ? "حساب مصرفي" : "نقدي (كاش)"}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {children.length > 0 && (
                        <Button variant="outline" size="sm" onClick={() => handleAddChild(parent.id)} className="mt-4 rounded-lg h-8 border-amber-500/10 hover:bg-amber-500/5 text-xs">
                          <Plus className="h-3.5 w-3.5 ml-1.5 text-amber-600" />
                          إضافة فرع / حساب بنكي
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab Content 2: Loans */}
      {activeTab === "loans" && (
        <div className="space-y-6">
          {/* Header row for Loans */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold flex items-center gap-2">
              <Banknote className="h-5 w-5 text-amber-600" />
              سجل السلف والعهد غير المسواة
            </h3>
            <Button onClick={() => navigate("/transfers")} className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs h-9">
              <Plus className="h-4 w-4 ml-1.5" />
              إدارة السلف والعهد الشاملة
            </Button>
          </div>

          {activeLoans.length === 0 && activeAdvances.length === 0 ? (
            <Card className="p-12 text-center border-dashed rounded-2xl">
              <Banknote className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">لا توجد سلف أو عهد معلقة</h3>
              <p className="text-sm text-muted-foreground mb-4">جميع السلف والعهد مغلقة ومسواة بالكامل</p>
              <Button onClick={() => navigate("/transfers")} className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl">
                إضافة سلفة جديدة
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Render Loans */}
              {activeLoans.map((loan: any) => (
                <div key={loan.id} className="border border-border/40 hover:border-rose-500/20 hover:shadow-md transition-all rounded-xl p-4 bg-card flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-none text-xs rounded-lg px-2 py-0.5">
                        سلفة
                      </Badge>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {loan.date}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-foreground mb-1">{loan.party_name}</h4>
                    {loan.projects?.name && (
                      <span className="text-[10px] text-muted-foreground block mb-2">المشروع: {loan.projects.name}</span>
                    )}
                    {loan.notes && (
                      <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg italic mt-2 line-clamp-2">
                        "{loan.notes}"
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t border-border/30 pt-3 mt-4">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">مبلغ السلفة</span>
                      <span className="text-base font-extrabold text-rose-600">{formatCurrencyLYD(Number(loan.amount))}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-rose-500/20 text-rose-700 dark:text-rose-400 bg-rose-500/5">
                      {loan.subtype === "partner" ? "شريك" : loan.subtype === "employee" ? "موظف" : "للغير"}
                    </Badge>
                  </div>
                </div>
              ))}

              {/* Render Advances/Custodies */}
              {activeAdvances.map((adv: any) => (
                <div key={adv.id} className="border border-border/40 hover:border-purple-500/20 hover:shadow-md transition-all rounded-xl p-4 bg-card flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-none text-xs rounded-lg px-2 py-0.5">
                        عهدة مؤقتة
                      </Badge>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {adv.date}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-foreground mb-1">{adv.party_name}</h4>
                    {adv.projects?.name && (
                      <span className="text-[10px] text-muted-foreground block mb-2">المشروع: {adv.projects.name}</span>
                    )}
                    {adv.notes && (
                      <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg italic mt-2 line-clamp-2">
                        "{adv.notes}"
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t border-border/30 pt-3 mt-4">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">مبلغ العهدة</span>
                      <span className="text-base font-extrabold text-purple-600">{formatCurrencyLYD(Number(adv.amount))}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-purple-500/20 text-purple-700 dark:text-purple-400 bg-purple-500/5">
                      {adv.subtype === "permanent" ? "عهد دائمة" : "لمرة واحدة"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Treasury Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleClose(); else setDialogOpen(true); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editing
                ? "تعديل بيانات الخزينة"
                : dialogMode === "parent"
                  ? "إضافة خزينة رئيسية جديدة"
                  : "إضافة فرع / حساب بنكي جديد"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3 text-right">
            {dialogMode === "child" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">نوع الفرع *</Label>
                <Select value={formData.treasury_type} onValueChange={(v) => setFormData({ ...formData, treasury_type: v })}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">نقدي (كاش)</SelectItem>
                    <SelectItem value="bank">حساب مصرفي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{dialogMode === "parent" ? "اسم الخزينة *" : "اسم الفرع *"}</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={
                  dialogMode === "parent"
                    ? "مثال: خزينة المكتب الرئيسية"
                    : formData.treasury_type === "bank"
                      ? "مثال: حساب مصرف الأمان"
                      : "مثال: كاش الموقع"
                }
                className="rounded-lg"
              />
            </div>
            
            {dialogMode === "child" && formData.treasury_type === "bank" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">اسم المصرف</Label>
                  <Input
                    value={formData.bank_name || ""}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    placeholder="مثال: مصرف الأمان"
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">رقم الحساب</Label>
                  <Input
                    value={formData.account_number || ""}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    placeholder="رقم الحساب"
                    className="rounded-lg text-left"
                  />
                </div>
              </div>
            )}
            
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">الوصف</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="تفاصيل إضافية للتعريف..."
                rows={2}
                className="rounded-lg resize-none"
              />
            </div>
            
            <div className="flex items-center gap-2 bg-muted/40 p-2.5 rounded-lg border border-border/30">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label className="text-xs font-semibold cursor-pointer select-none">تفعيل الخزينة (نشطة لاستلام وإرسال المبالغ)</Label>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ملاحظات داخلية</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="ملاحظات أخرى..."
                rows={2}
                className="rounded-lg resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button variant="outline" onClick={handleClose} className="rounded-lg">
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg">
              {saveMutation.isPending ? "جاري الحفظ..." : editing ? "حفظ التعديلات" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle className="font-bold flex items-center gap-2 text-red-600">
              <ShieldAlert className="h-5 w-5" />
              تأكيد حذف الخزينة
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              هل أنت متأكد من رغبتك في حذف هذا العنصر؟ سيؤدي هذا إلى حذف الخزينة الرئيسية وجميع فروعها وحساباتها نهائياً من النظام. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="rounded-lg text-xs">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold"
            >
              حذف نهائي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={(open) => { if (!open) { setTransferDialogOpen(false); setTransferForm({ fromTreasuryId: "", toTreasuryId: "", amount: 0, reason: "", date: new Date().toISOString().split("T")[0] }); } }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-amber-600" />
              نقل أموال بين الخزائن والفروع
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3 text-right">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">من خزينة (المصدر) *</Label>
              <Select value={transferForm.fromTreasuryId} onValueChange={(v) => setTransferForm({ ...transferForm, fromTreasuryId: v, toTreasuryId: transferForm.toTreasuryId === v ? "" : transferForm.toTreasuryId })}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="اختر الخزينة المصدر" />
                </SelectTrigger>
                <SelectContent>
                  {childTreasuries.filter(t => t.is_active).map(t => {
                    const parent = parentTreasuries.find(p => p.id === t.parent_id);
                    return (
                      <SelectItem key={t.id} value={t.id}>
                        {parent ? `${parent.name} / ` : ""}{t.name} ({formatCurrencyLYD(t.balance)})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">إلى خزينة (الوجهة) *</Label>
              <Select value={transferForm.toTreasuryId} onValueChange={(v) => setTransferForm({ ...transferForm, toTreasuryId: v })}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="اختر الخزينة الوجهة" />
                </SelectTrigger>
                <SelectContent>
                  {childTreasuries.filter(t => t.is_active && t.id !== transferForm.fromTreasuryId).map(t => {
                    const parent = parentTreasuries.find(p => p.id === t.parent_id);
                    return (
                      <SelectItem key={t.id} value={t.id}>
                        {parent ? `${parent.name} / ` : ""}{t.name} ({formatCurrencyLYD(t.balance)})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">المبلغ المراد نقله (د.ل) *</Label>
              <Input
                type="number"
                step="0.01"
                value={transferForm.amount || ""}
                onChange={(e) => setTransferForm({ ...transferForm, amount: Number(e.target.value) })}
                placeholder="0.00"
                className="rounded-lg font-bold text-base text-amber-700"
              />
              {transferForm.fromTreasuryId && (
                <p className="text-[11px] text-muted-foreground bg-amber-500/5 p-1 px-2 rounded border border-amber-500/10 inline-block">
                  الرصيد المتاح للتحويل: {formatCurrencyLYD(treasuries?.find(t => t.id === transferForm.fromTreasuryId)?.balance || 0)}
                </p>
              )}
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">البيان وسبب النقل *</Label>
              <Textarea
                value={transferForm.reason}
                onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                placeholder="اكتب تفاصيل أو سبب تحويل ونقل هذه الأموال..."
                rows={2}
                className="rounded-lg resize-none"
              />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">تاريخ العملية</Label>
              <Input
                type="date"
                value={transferForm.date}
                onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })}
                className="rounded-lg"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)} className="rounded-lg">
              إلغاء
            </Button>
            <Button
              onClick={() => {
                if (!transferForm.fromTreasuryId || !transferForm.toTreasuryId) {
                  toast({ title: "خطأ", description: "يرجى اختيار الخزينتين", variant: "destructive" });
                  return;
                }
                if (transferForm.amount <= 0) {
                  toast({ title: "خطأ", description: "يرجى إدخال مبلغ صحيح", variant: "destructive" });
                  return;
                }
                if (!transferForm.reason.trim()) {
                  toast({ title: "خطأ", description: "يرجى كتابة سبب النقل", variant: "destructive" });
                  return;
                }
                const fromBalance = treasuries?.find(t => t.id === transferForm.fromTreasuryId)?.balance || 0;
                if (transferForm.amount > fromBalance) {
                  toast({ title: "خطأ", description: "الرصيد غير كافٍ في الخزينة المصدر", variant: "destructive" });
                  return;
                }
                transferMutation.mutate(transferForm);
              }}
              disabled={transferMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
            >
              {transferMutation.isPending ? "جاري التحويل..." : "تحويل الآن"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Treasuries;
