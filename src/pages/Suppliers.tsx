import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Phone, Mail, Truck, Building, ShoppingCart, FolderOpen, Edit, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "react-router-dom";
import { formatCurrencyLYD } from "@/lib/currency";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

const paymentStatusLabels: Record<string, { label: string; color: string }> = {
  paid: { label: "مدفوع بالكامل", color: "bg-green-500/10 text-green-500" },
  partial: { label: "مدفوع جزئياً", color: "bg-yellow-500/10 text-yellow-500" },
  processing: { label: "قيد المعالجة", color: "bg-blue-500/10 text-blue-500" },
  due: { label: "مستحق", color: "bg-red-500/10 text-red-500" },
};

interface SupplierForm {
  name: string;
  category: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

const initialForm: SupplierForm = {
  name: "",
  category: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

export default function Suppliers() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<string | null>(null);
  const [form, setForm] = useState<SupplierForm>(initialForm);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<{ id: string; name: string } | null>(null);

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch purchases to calculate stats per supplier
  const { data: purchaseStats } = useQuery({
    queryKey: ["supplier-purchase-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select(`
          supplier_id,
          total_amount,
          project_id,
          projects (
            client_id
          )
        `);
      
      if (error) throw error;
      
      // Group by supplier
      const stats: Record<string, { 
        purchaseCount: number; 
        clientCount: number; 
        projectCount: number;
        totalAmount: number;
        clients: Set<string>;
        projects: Set<string>;
      }> = {};
      
      data?.forEach((purchase) => {
        if (purchase.supplier_id) {
          if (!stats[purchase.supplier_id]) {
            stats[purchase.supplier_id] = {
              purchaseCount: 0,
              clientCount: 0,
              projectCount: 0,
              totalAmount: 0,
              clients: new Set(),
              projects: new Set(),
            };
          }
          stats[purchase.supplier_id].purchaseCount++;
          stats[purchase.supplier_id].totalAmount += Number(purchase.total_amount) || 0;
          
          if (purchase.project_id) {
            stats[purchase.supplier_id].projects.add(purchase.project_id);
          }
          if (purchase.projects?.client_id) {
            stats[purchase.supplier_id].clients.add(purchase.projects.client_id);
          }
        }
      });
      
      // Convert Sets to counts
      Object.keys(stats).forEach((key) => {
        stats[key].clientCount = stats[key].clients.size;
        stats[key].projectCount = stats[key].projects.size;
      });
      
      return stats;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: SupplierForm) => {
      const supplierData = {
        name: data.name,
        category: data.category || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        notes: data.notes || null,
      };

      if (editingSupplier) {
        const { error } = await supabase
          .from("suppliers")
          .update(supplierData)
          .eq("id", editingSupplier);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert(supplierData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success(editingSupplier ? "تم تحديث المورد بنجاح" : "تمت إضافة المورد بنجاح");
      handleCloseDialog();
    },
    onError: () => {
      toast.error("حدث خطأ أثناء حفظ البيانات");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (supplierId: string) => {
      // First delete all related purchases
      const { error: purchasesError } = await supabase
        .from("purchases")
        .delete()
        .eq("supplier_id", supplierId);
      if (purchasesError) throw purchasesError;

      // Delete related project_suppliers entries
      const { error: projectSuppliersError } = await supabase
        .from("project_suppliers")
        .delete()
        .eq("supplier_id", supplierId);
      if (projectSuppliersError) throw projectSuppliersError;

      // Delete related expenses
      const { error: expensesError } = await supabase
        .from("expenses")
        .delete()
        .eq("supplier_id", supplierId);
      if (expensesError) throw expensesError;

      // Finally delete the supplier
      const { error } = await supabase
        .from("suppliers")
        .delete()
        .eq("id", supplierId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-purchase-stats"] });
      toast.success("تم حذف المورد وجميع المشتريات المرتبطة بنجاح");
      setDeleteDialogOpen(false);
      setSupplierToDelete(null);
    },
    onError: () => {
      toast.error("حدث خطأ أثناء حذف المورد");
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingSupplier(null);
    setForm(initialForm);
  };

  const handleEdit = (supplier: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingSupplier(supplier.id);
    setForm({
      name: supplier.name,
      category: supplier.category || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      notes: supplier.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (supplier: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSupplierToDelete({ id: supplier.id, name: supplier.name });
    setDeleteDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("يرجى إدخال اسم المورد");
      return;
    }
    saveMutation.mutate(form);
  };

  const [query, setQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");

  const categories = Array.from(new Set(suppliers?.map((s) => s.category).filter(Boolean) || []));

  const filtered = suppliers?.filter((s) => {
    if (query && !s.name.includes(query)) return false;
    if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
    return true;
  }) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">الموردون</h1>
          <p className="text-muted-foreground">إدارة الموردين والمشتريات</p>
        </div>
        <div className="flex items-center gap-3">
          <Input 
            placeholder="بحث باسم المورد..." 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            className="w-48"
          />
          <select 
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={categoryFilter} 
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">كل الأنشطة</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={() => { setEditingSupplier(null); setForm(initialForm); }}>
                <Plus className="h-4 w-4" />
                مورد جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingSupplier ? "تعديل بيانات المورد" : "إضافة مورد جديد"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">اسم المورد *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="أدخل اسم المورد"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">النشاط / التصنيف</Label>
                  <Input
                    id="category"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="مثال: مواد بناء، حديد، كهرباء"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">رقم الهاتف</Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="09xxxxxxxx"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">البريد الإلكتروني</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="example@mail.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">العنوان</Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="أدخل العنوان"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">ملاحظات</Label>
                  <Textarea
                    id="notes"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="أي ملاحظات إضافية..."
                    rows={2}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? "جاري الحفظ..." : editingSupplier ? "تحديث" : "إضافة"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    إلغاء
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Truck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">إجمالي الموردين</p>
              <p className="text-2xl font-bold">{suppliers?.length || 0}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <ShoppingCart className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">إجمالي المشتريات</p>
              <p className="text-xl font-bold">
                {formatCurrencyLYD(suppliers?.reduce((sum, s) => sum + Number(s.total_purchases), 0) || 0)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Building className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">عملاء مرتبطين</p>
              <p className="text-2xl font-bold">
                {new Set(Object.values(purchaseStats || {}).flatMap((s) => Array.from(s.clients))).size}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <FolderOpen className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">مشاريع مرتبطة</p>
              <p className="text-2xl font-bold">
                {new Set(Object.values(purchaseStats || {}).flatMap((s) => Array.from(s.projects))).size}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Suppliers Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((supplier) => {
          const stats = purchaseStats?.[supplier.id] || { 
            purchaseCount: 0, 
            clientCount: 0, 
            projectCount: 0, 
            totalAmount: 0 
          };
          const status = paymentStatusLabels[supplier.payment_status || "paid"];
          
          return (
            <Link key={supplier.id} to={`/suppliers/${supplier.id}`}>
              <Card className="p-6 card-hover cursor-pointer transition-all hover:shadow-lg h-full">
                <div className="space-y-4">
                  {/* Supplier Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Truck className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">{supplier.name}</h3>
                        {supplier.category && (
                          <Badge variant="outline" className="mt-1">{supplier.category}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => handleEdit(supplier, e)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => handleDelete(supplier, e)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {supplier.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span>{supplier.phone}</span>
                      </div>
                    )}
                    {supplier.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span className="truncate">{supplier.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Building className="h-3 w-3 text-blue-500" />
                        <span className="text-xl font-bold text-blue-500">{stats.clientCount}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">عميل</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <FolderOpen className="h-3 w-3 text-orange-500" />
                        <span className="text-xl font-bold text-orange-500">{stats.projectCount}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">مشروع</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <ShoppingCart className="h-3 w-3 text-green-500" />
                        <span className="text-xl font-bold text-green-500">{stats.purchaseCount}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">فاتورة</p>
                    </div>
                  </div>

                  {/* Total Purchases */}
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div>
                      <p className="text-xs text-muted-foreground">إجمالي المشتريات</p>
                      <p className="text-lg font-bold text-primary">{formatCurrencyLYD(supplier.total_purchases)}</p>
                    </div>
                    <Badge className={status.color}>{status.label}</Badge>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 bg-muted/30 rounded-lg">
          <Truck className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">لا يوجد موردين</p>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف المورد "{supplierToDelete?.name}"؟
              <br />
              <span className="text-destructive font-semibold">
                سيتم حذف جميع المشتريات والمصروفات المرتبطة بهذا المورد نهائياً.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => supplierToDelete && deleteMutation.mutate(supplierToDelete.id)}
            >
              {deleteMutation.isPending ? "جاري الحذف..." : "حذف المورد"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
