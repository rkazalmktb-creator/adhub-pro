import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Palette, ArrowLeft, TrendingUp, TrendingDown, ArrowLeftRight, ShoppingCart, Wallet, Receipt, AlertCircle, ExternalLink } from "lucide-react";

// Sub-component for overdue purchases in settings
const OverduePurchasesSummary = () => {
  const navigate = useNavigate();
  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["settings-overdue-purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("id, total_amount, paid_amount, status, date, invoice_number, suppliers(name), projects(name)")
        .eq("status", "due")
        .order("date", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">جاري التحميل...</div>;

  if (purchases.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        <p className="text-sm">✅ لا توجد فواتير مستحقة حالياً</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {purchases.map((p: any) => (
        <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-destructive/5 border border-destructive/20">
          <div>
            <p className="text-sm font-medium">{p.suppliers?.name || "مورد غير محدد"}</p>
            <p className="text-xs text-muted-foreground">
              {p.projects?.name ? `${p.projects.name} — ` : ""}
              {p.invoice_number ? `فاتورة #${p.invoice_number}` : ""} {p.date}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-destructive">
              {Number(p.total_amount - p.paid_amount).toLocaleString("ar-LY")} د.ل
            </p>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full mt-2 animate-none" onClick={() => navigate("/project-expenses")}>
        عرض جميع الفواتير المستحقة
      </Button>
    </div>
  );
};

const Settings = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">الإعدادات العامة</h1>
        <p className="text-muted-foreground">التحكم بالوصول المالي السريع وإعدادات الطباعة</p>
      </div>

      <div className="space-y-6">
        {/* Print Settings Card */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary font-bold text-lg">
              <Palette className="h-5 w-5" />
              إعدادات وتصميم الطباعة والهوية
            </CardTitle>
            <CardDescription>
              تخصيص ألوان الجداول والخطوط وتفعيل الهيدر والفوتر النصي الموحد ومعلومات الشركة والشعار مع معاينة حية تفاعلية.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/print-design">
              <Button className="w-full gap-2 cursor-pointer">
                <Palette className="h-4 w-4" />
                فتح صفحة تصميم الطباعة وإعدادات الهوية
                <ArrowLeft className="h-4 w-4 mr-auto" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Financial Pages Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
              <Receipt className="h-5 w-5 text-primary" />
              الفواتير والسجلات المالية
            </CardTitle>
            <CardDescription>
              وصول سريع لجميع صفحات الفواتير والسجلات المالية وإمكانية التحكم والتعديل
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {[
                { href: "/income", icon: TrendingUp, label: "سجل الإيرادات", desc: "إضافة وتعديل وحذف الإيرادات", color: "text-green-600", badge: "إيرادات" },
                { href: "/expenses", icon: TrendingDown, label: "سجل المصروفات", desc: "إدارة المصروفات والمشتريات", color: "text-red-600", badge: "مصروفات" },
                { href: "/transfers", icon: ArrowLeftRight, label: "التحويلات", desc: "سلف وعهد وتحويلات مالية", color: "text-blue-600", badge: "تحويلات" },
                { href: "/project-expenses", icon: ShoppingCart, label: "مصروفات المشاريع", desc: "جميع مشتريات المشاريع", color: "text-orange-600", badge: "مشتريات" },
                { href: "/treasuries", icon: Wallet, label: "الخزائن", desc: "إدارة الخزائن والأرصدة", color: "text-primary", badge: "خزائن" },
                { href: "/client-activities", icon: Receipt, label: "حركات الزبائن", desc: "دفعات وحسابات العملاء", color: "text-purple-600", badge: "عملاء" },
              ].map((item) => (
                <Link key={item.href} to={item.href}>
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer group">
                    <div className="p-2 rounded-md bg-muted group-hover:bg-primary/10 transition-colors">
                      <item.icon className={`h-4 w-4 ${item.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold truncate">{item.label}</p>
                        <Badge variant="secondary" className="text-[10px] shrink-0">{item.badge}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Overdue Bills Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
              <AlertCircle className="h-5 w-5 text-destructive" />
              الفواتير المستحقة
            </CardTitle>
            <CardDescription>
              عرض الفواتير المستحقة الحالية للموردين والوصول المباشر لإدارتها
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OverduePurchasesSummary />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
