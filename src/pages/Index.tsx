import { useState, useMemo } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  HardHat,
  FileText,
  Calendar,
  Settings,
  TrendingUp,
  TrendingDown,
  Receipt,
  ArrowLeftRight,
  Package,
  GraduationCap,
  Building2,
  LogOut,
  Shield,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  Wrench,
  Truck,
  Coins,
  UserCog,
  Wallet,
  ChevronDown,
  History,
  BarChart3,
  AlertTriangle,
  Warehouse,
  ClipboardCheck,
  GitBranch,
  CalendarDays,
} from "lucide-react";

// Navigation groups with role restrictions
type NavItem = { name: string; href: string; icon: any; roles: string[]; badge?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const getNavigationGroups = (isAdmin: boolean, isEngineer: boolean, isAccountant: boolean, userRole?: string): NavGroup[] => {
  const filterItems = (items: NavItem[]) =>
    items.filter(item => {
      const role = userRole || (isAdmin ? "admin" : isEngineer ? "engineer" : isAccountant ? "accountant" : "admin");
      return item.roles.includes(role) || (isAdmin && item.roles.includes("admin"));
    });

  const groups: NavGroup[] = [
    {
      label: "الرئيسية",
      items: [
        { name: "لوحة التحكم", href: "/", icon: LayoutDashboard, roles: ["admin", "engineer", "supervisor"] },
        { name: "لوحة التحكم المالية", href: "/accountant", icon: Coins, roles: ["admin", "accountant"] },
        { name: "المشاريع", href: "/projects", icon: FolderKanban, roles: ["admin", "engineer", "supervisor"] },
        { name: "سجل حركات الزبائن", href: "/client-activities", icon: Users, roles: ["admin", "accountant"] },
      ],
    },
    {
      label: "العمليات",
      items: [
        { name: "البنود العامة", href: "/general-items", icon: Package, roles: ["admin", "supervisor"] },
        { name: "المعدات", href: "/equipment", icon: Wrench, roles: ["admin", "supervisor"] },
        { name: "إيجارات المشاريع", href: "/rentals", icon: Truck, roles: ["admin", "supervisor"], badge: true },
        { name: "المخازن", href: "/inventory", icon: Warehouse, roles: ["admin", "supervisor"] },
      ],
    },
    {
      label: "التخطيط والمخاطر",
      items: [
        { name: "التدفق النقدي", href: "/cash-flow", icon: BarChart3, roles: ["admin", "accountant"] },
        { name: "سجل المخاطر", href: "/risk-register", icon: AlertTriangle, roles: ["admin", "supervisor", "engineer"] },
        { name: "الجدولة الزمنية", href: "/schedule", icon: CalendarDays, roles: ["admin", "engineer", "supervisor"] },
        { name: "ضبط الجودة", href: "/quality", icon: ClipboardCheck, roles: ["admin", "engineer", "supervisor"] },
        { name: "أوامر التغيير", href: "/variation-orders", icon: GitBranch, roles: ["admin", "accountant"] },
      ],
    },
    {
      label: "الأشخاص",
      items: [
        { name: "العملاء", href: "/clients", icon: Users, roles: ["admin", "accountant"] },
        { name: "الموردون", href: "/suppliers", icon: Receipt, roles: ["admin", "accountant"] },
        { name: "الفنيون", href: "/technicians", icon: HardHat, roles: ["admin", "engineer", "supervisor"] },
        { name: "المهندسون", href: "/engineers", icon: GraduationCap, roles: ["admin"] },
        { name: "الموظفين", href: "/employees", icon: UserCog, roles: ["admin"] },
      ],
    },
    {
      label: "المالية",
      items: [
        { name: "مصروفات المشاريع", href: "/project-expenses", icon: Coins, roles: ["admin", "accountant"] },
        { name: "مركز الفواتير", href: "/invoice-control", icon: Receipt, roles: ["admin", "accountant"] },
        { name: "خزائن الشركة", href: "/treasuries", icon: Wallet, roles: ["admin", "accountant"] },
        { name: "الدخول", href: "/income", icon: TrendingUp, roles: ["admin", "accountant"] },
        { name: "الدخول والخروج", href: "/transfers", icon: ArrowLeftRight, roles: ["admin", "accountant"] },
        { name: "الخروج", href: "/expenses", icon: TrendingDown, roles: ["admin", "accountant"] },
      ],
    },
    {
      label: "النظام",
      items: [
        { name: "التقارير", href: "/reports", icon: FileText, roles: ["admin"] },
        { name: "سجل التعديلات", href: "/audit-log", icon: History, roles: ["admin"] },
        { name: "المستخدمون", href: "/users", icon: Shield, roles: ["admin"] },
        { name: "التقويم", href: "/calendar", icon: Calendar, roles: ["admin"] },
        { name: "الإعدادات", href: "/settings", icon: Settings, roles: ["admin"] },
        { name: "تصميم الطباعة", href: "/print-design", icon: Palette, roles: ["admin"] },
        { name: "قوالب العقود", href: "/contract-templates", icon: FileText, roles: ["admin"] },
      ],
    },
  ];

  return groups
    .map(g => ({ ...g, items: filterItems(g.items) }))
    .filter(g => g.items.length > 0);
};

const Index = () => {
  const location = useLocation();
  const { user, isAdmin, isEngineer, isAccountant, role, signOut } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .limit(1)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch active rentals count
  const { data: activeRentalsCount } = useQuery({
    queryKey: ["active-rentals-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("equipment_rentals")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      
      if (error) throw error;
      return count || 0;
    },
  });

  const navigationGroups = getNavigationGroups(isAdmin, isEngineer, isAccountant, role || undefined);

  // Track which group has an active item to auto-open it
  const activeGroupLabel = useMemo(() => {
    for (const group of navigationGroups) {
      for (const item of group.items) {
        const isActive = item.href === "/"
          ? location.pathname === "/"
          : location.pathname === item.href || location.pathname.startsWith(item.href + "/");
        if (isActive) return group.label;
      }
    }
    return navigationGroups[0]?.label;
  }, [location.pathname, navigationGroups]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const isGroupOpen = (label: string) => {
    if (label in openGroups) return openGroups[label];
    // Default: open the group with the active item, and "الرئيسية"
    return label === activeGroupLabel || label === "الرئيسية";
  };

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !isGroupOpen(label) }));
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Collapsible Sidebar */}
      <aside 
        className={cn(
          "fixed right-0 top-0 z-40 h-screen bg-sidebar border-l border-sidebar-border transition-all duration-300",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo & Toggle */}
          <div className={cn(
            "flex h-20 items-center border-b border-sidebar-border",
            sidebarCollapsed ? "justify-center px-2" : "justify-between px-4"
          )}>
            {!sidebarCollapsed && (
              <div className="flex items-center gap-3">
                {settings?.company_logo ? (
                  <img 
                    src={settings.company_logo} 
                    alt={settings?.company_name || "شعار الشركة"}
                    className="h-10 w-10 object-contain rounded-md"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-primary text-lg font-bold truncate max-w-[120px]">
                    {settings?.company_name || "ركاز"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">منظومة إدارة المقاولات</span>
                </div>
              </div>
            )}
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="shrink-0"
              title={sidebarCollapsed ? "إظهار القائمة" : "إخفاء القائمة"}
            >
              {sidebarCollapsed ? (
                <PanelRightOpen className="h-5 w-5" />
              ) : (
                <PanelRightClose className="h-5 w-5" />
              )}
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-2 overflow-y-auto">
            <ul className="space-y-1">
              {navigationGroups.map((group) => (
                <li key={group.label}>
                  {!sidebarCollapsed ? (
                    <button
                      onClick={() => toggleGroup(group.label)}
                      className="flex w-full items-center justify-between px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-muted-foreground transition-colors"
                    >
                      <span>{group.label}</span>
                      <ChevronDown className={cn(
                        "h-3 w-3 transition-transform duration-200",
                        !isGroupOpen(group.label) && "-rotate-90"
                      )} />
                    </button>
                  ) : (
                    <div className="my-2 mx-2 border-t border-sidebar-border" />
                  )}
                  {(sidebarCollapsed || isGroupOpen(group.label)) && (
                    <ul className="space-y-0.5">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive =
                          item.href === "/"
                            ? location.pathname === "/"
                            : location.pathname === item.href || location.pathname.startsWith(item.href + "/");

                        return (
                          <li key={item.name}>
                            <Link
                              to={item.href}
                              className={cn(
                                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                sidebarCollapsed && "justify-center px-2",
                                isActive
                                  ? "bg-primary text-primary-foreground shadow-sm"
                                  : "text-sidebar-foreground hover:bg-primary/10 hover:text-primary",
                              )}
                              title={sidebarCollapsed ? item.name : undefined}
                            >
                              <div className="relative shrink-0">
                                <Icon className="h-4.5 w-4.5" />
                                {item.badge && activeRentalsCount && activeRentalsCount > 0 && (
                                  <Badge
                                    variant="destructive"
                                    className="absolute -top-2 -left-2 h-4 min-w-4 px-1 text-[10px] leading-none flex items-center justify-center"
                                  >
                                    {activeRentalsCount}
                                  </Badge>
                                )}
                              </div>
                              {!sidebarCollapsed && (
                                <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                                  <span className="min-w-0 truncate">{item.name}</span>
                                  {item.badge && activeRentalsCount && activeRentalsCount > 0 && (
                                    <Badge variant="secondary" className="text-[10px] shrink-0">
                                      {activeRentalsCount} نشط
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {/* User Info */}
          <div className={cn(
            "border-t border-sidebar-border p-3",
            sidebarCollapsed && "flex flex-col items-center"
          )}>
            {!sidebarCollapsed ? (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary shrink-0">
                  {isAdmin ? <Shield className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {profile?.display_name || profile?.username || user?.email?.split('@')[0] || "المستخدم"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {profile?.title || (isAdmin ? "مدير النظام" : isEngineer ? "مهندس" : "مستخدم")}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={handleSignOut} title="تسجيل الخروج">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleSignOut} 
                title="تسجيل الخروج"
                className="mt-2"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div 
        className={cn(
          "flex-1 flex flex-col transition-all duration-300",
          sidebarCollapsed ? "mr-16" : "mr-64"
        )}
      >
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Index;
