import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
  X
} from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";
import { useState } from "react";

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
        };
      }
      acc[client.id].projects[project.id].purchases.push(purchase);
      acc[client.id].projects[project.id].totalAmount += Number(purchase.total_amount);
    }
    
    acc[client.id].totalAmount += Number(purchase.total_amount);
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
    paidAmount: purchases?.filter((p) => p.status === "paid").reduce((sum, p) => sum + Number(p.total_amount), 0) || 0,
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
                <Badge variant="outline">{supplier.category}</Badge>
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
        <Badge className={statusColors[supplier.payment_status || "paid"]}>
          {statusLabels[supplier.payment_status || "paid"]}
        </Badge>
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

                <div className="text-center pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-1">إجمالي المشتريات</p>
                  <p className="text-lg font-bold text-primary">{formatCurrencyLYD(clientData.totalAmount)}</p>
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

                  <div className="text-center pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-1">إجمالي المشتريات</p>
                    <p className="text-lg font-bold text-primary">{formatCurrencyLYD(projectData.totalAmount)}</p>
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
                    <TableHead className="text-right">البنود</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedProjectData.purchases
                    .filter((p: Purchase) => statusFilter === "all" || p.status === statusFilter)
                    .map((purchase: Purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell className="font-medium">
                        {purchase.invoice_number || "-"}
                      </TableCell>
                      <TableCell>{purchase.date}</TableCell>
                      <TableCell>
                        {Array.isArray(purchase.items) && purchase.items.length > 0 ? (
                          <div className="space-y-1">
                            {purchase.items.slice(0, 3).map((item: any, idx: number) => (
                              <div key={idx} className="text-sm">
                                {item.name} ({item.qty} × {formatCurrencyLYD(item.price)})
                              </div>
                            ))}
                            {purchase.items.length > 3 && (
                              <div className="text-xs text-muted-foreground">
                                +{purchase.items.length - 3} بنود أخرى
                              </div>
                            )}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="font-bold text-primary">
                        {formatCurrencyLYD(purchase.total_amount)}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[purchase.status]}>
                          {statusLabels[purchase.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
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
    </div>
  );
};

export default SupplierDetail;
