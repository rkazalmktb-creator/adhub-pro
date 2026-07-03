import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Search,
  Building,
  FolderKanban,
  ChevronDown,
  ChevronUp,
  Package,
  ShoppingCart,
  Coins,
  TrendingUp,
  Pencil,
  Printer,
  Wrench,
  Layers,
  MapPin,
  HardHat,
  FileText,
  LayoutGrid,
  List as ListIcon,
  MoreHorizontal,
  AlertTriangle,
  Wallet,
  CalendarDays,
  ClipboardCheck,
  GitBranch,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { formatCurrencyLYD } from "@/lib/currency";
import { useAuth } from "@/contexts/AuthContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const statusLabels: Record<string, string> = {
  active: "نشط",
  pending: "قيد الانتظار",
  completed: "مكتمل",
  cancelled: "ملغي",
};

const statusDot: Record<string, string> = {
  active: "bg-green-500",
  pending: "bg-yellow-500",
  completed: "bg-blue-500",
  cancelled: "bg-red-500",
};

const statusBadgeClass: Record<string, string> = {
  active: "bg-green-500/10 text-green-600 border-green-500/20",
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  completed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  cancelled: "bg-red-500/10 text-red-600 border-red-500/20",
};

const Projects = () => {
  const { isEngineer, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    return (localStorage.getItem("projects-view-mode") as "grid" | "list") || "grid";
  });

  const handleViewModeChange = (mode: "grid" | "list") => {
    setViewMode(mode);
    localStorage.setItem("projects-view-mode", mode);
  };

  // Fetch all projects with client info
  const { data: projects, isLoading } = useQuery({
    queryKey: ["all-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients(id, name), supervising_engineer:engineers!projects_supervising_engineer_id_fkey(id, name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch phases for expanded projects
  const { data: phasesMap } = useQuery({
    queryKey: ["projects-phases", Array.from(expandedProjects)],
    queryFn: async () => {
      if (expandedProjects.size === 0) return {};
      const { data, error } = await supabase
        .from("project_phases")
        .select("*")
        .in("project_id", Array.from(expandedProjects))
        .order("order_index", { ascending: true });
      if (error) throw error;

      const map: Record<string, typeof data> = {};
      data?.forEach((phase) => {
        if (!map[phase.project_id]) map[phase.project_id] = [];
        map[phase.project_id].push(phase);
      });
      return map;
    },
    enabled: expandedProjects.size > 0,
  });

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  // Filter projects
  const filteredProjects = projects?.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.clients?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.location?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const totalProjects = projects?.length || 0;
  const activeCount = projects?.filter((p) => p.status === "active").length || 0;
  const pendingCount = projects?.filter((p) => p.status === "pending").length || 0;
  const completedCount = projects?.filter((p) => p.status === "completed").length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">جاري تحميل المشاريع...</p>
        </div>
      </div>
    );
  }

  const renderQuickNavMenu = (projectId: string) => (
    <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
      <DropdownMenuGroup>
        <DropdownMenuItem onClick={() => navigate(`/projects/${projectId}/phases`)} className="gap-2 cursor-pointer">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span>المراحل</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(`/projects/${projectId}/schedule`)} className="gap-2 cursor-pointer">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span>الجدولة الزمنية</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(`/projects/${projectId}/progress`)} className="gap-2 cursor-pointer">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <span>نسب الإنجاز</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(`/projects/${projectId}/contracts`)} className="gap-2 cursor-pointer">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span>العقود</span>
        </DropdownMenuItem>
        {!isEngineer && (
          <>
            <DropdownMenuItem onClick={() => navigate(`/projects/${projectId}/purchases`)} className="gap-2 cursor-pointer">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <span>المشتريات</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`/projects/${projectId}/expenses`)} className="gap-2 cursor-pointer">
              <Coins className="h-4 w-4 text-muted-foreground" />
              <span>المصروفات</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`/projects/${projectId}/payments`)} className="gap-2 cursor-pointer">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span>المدفوعات</span>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem onClick={() => navigate(`/projects/${projectId}/equipment`)} className="gap-2 cursor-pointer">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <span>إيجارات المعدات</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(`/projects/${projectId}/quality`)} className="gap-2 cursor-pointer">
          <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          <span>ضبط الجودة</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(`/projects/${projectId}/risk-register`)} className="gap-2 cursor-pointer">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <span>سجل المخاطر</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(`/projects/${projectId}/variation-orders`)} className="gap-2 cursor-pointer">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <span>أوامر التغيير</span>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      {isAdmin && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate(`/projects/${projectId}/edit`)} className="gap-2 text-primary cursor-pointer">
            <Pencil className="h-4 w-4" />
            <span>إعدادات المشروع</span>
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenuContent>
  );

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">المشاريع</h1>
          <p className="text-sm text-muted-foreground">شاشة التحكم وإدارة كافة المشاريع والعمليات المرتبطة بها</p>
        </div>
        {isAdmin && (
          <Button onClick={() => navigate("/projects/new")} className="gap-2 bg-primary hover:bg-primary/90 cursor-pointer shadow-sm">
            <Plus className="h-4 w-4" />
            <span>مشروع جديد</span>
          </Button>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-r-4 border-r-primary overflow-hidden shadow-sm transition-all hover:-translate-y-0.5 duration-200">
          <CardContent className="p-4 flex flex-col justify-center">
            <p className="text-2xl font-bold text-primary font-mono">{totalProjects}</p>
            <p className="text-xs text-muted-foreground font-medium mt-1">إجمالي المشاريع</p>
          </CardContent>
        </Card>
        <Card className="border-r-4 border-r-green-500 overflow-hidden shadow-sm transition-all hover:-translate-y-0.5 duration-200">
          <CardContent className="p-4 flex flex-col justify-center">
            <p className="text-2xl font-bold text-green-500 font-mono">{activeCount}</p>
            <p className="text-xs text-muted-foreground font-medium mt-1">مشاريع نشطة</p>
          </CardContent>
        </Card>
        <Card className="border-r-4 border-r-yellow-500 overflow-hidden shadow-sm transition-all hover:-translate-y-0.5 duration-200">
          <CardContent className="p-4 flex flex-col justify-center">
            <p className="text-2xl font-bold text-yellow-500 font-mono">{pendingCount}</p>
            <p className="text-xs text-muted-foreground font-medium mt-1">قيد الانتظار</p>
          </CardContent>
        </Card>
        <Card className="border-r-4 border-r-blue-500 overflow-hidden shadow-sm transition-all hover:-translate-y-0.5 duration-200">
          <CardContent className="p-4 flex flex-col justify-center">
            <p className="text-2xl font-bold text-blue-500 font-mono">{completedCount}</p>
            <p className="text-xs text-muted-foreground font-medium mt-1">مشاريع مكتملة</p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center bg-card p-3 rounded-lg border shadow-sm">
        <div className="flex gap-3 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث باسم المشروع، العميل، أو الموقع..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-9 focus-visible:ring-primary"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] focus:ring-primary">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="pending">قيد الانتظار</SelectItem>
              <SelectItem value="completed">مكتمل</SelectItem>
              <SelectItem value="cancelled">ملغي</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 border rounded-lg p-0.5 bg-muted self-end sm:self-auto">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => handleViewModeChange("grid")}
            className="h-8 w-8 cursor-pointer rounded-md"
            title="عرض شبكي"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => handleViewModeChange("list")}
            className="h-8 w-8 cursor-pointer rounded-md"
            title="عرض قائمة"
          >
            <ListIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredProjects?.length === 0 ? (
        <Card className="p-16 text-center border-dashed">
          <FolderKanban className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold">لا توجد مشاريع</h3>
          <p className="text-muted-foreground text-sm mt-1">لم يتم العثور على مشاريع تطابق خيارات البحث الحالية.</p>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects?.map((project) => {
            const isExpanded = expandedProjects.has(project.id);
            const phases = phasesMap?.[project.id] || [];
            const isOverBudget = !isEngineer && project.budget > 0 && (project.spent || 0) > project.budget;

            return (
              <Card
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}/phases`)}
                className="overflow-hidden transition-all hover:shadow-md cursor-pointer group flex flex-col border hover:border-primary/30 relative"
              >
                {/* Project Image Header */}
                <div className="relative h-44 bg-muted overflow-hidden shrink-0">
                  {project.image_url ? (
                    <img
                      src={project.image_url}
                      alt={project.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                      <FolderKanban className="h-14 w-14 text-primary/20" />
                    </div>
                  )}
                  {/* Status Overlay */}
                  <Badge
                    variant="outline"
                    className={`absolute top-3 right-3 text-xs px-2.5 py-0.5 backdrop-blur-md shadow-sm border ${statusBadgeClass[project.status] || ""}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${statusDot[project.status]} ml-1.5 inline-block`} />
                    {statusLabels[project.status] || project.status}
                  </Badge>

                  {/* Overbudget Badge */}
                  {isOverBudget && (
                    <Badge
                      variant="destructive"
                      className="absolute top-3 left-3 text-[10px] px-2 py-0.5 animate-pulse flex items-center gap-1 shadow"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      <span>تجاوز الميزانية</span>
                    </Badge>
                  )}
                </div>

                {/* Card Content */}
                <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-4">
                  {/* Title & Metadata */}
                  <div className="space-y-2">
                    <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors leading-tight line-clamp-1">
                      {project.name}
                    </h3>
                    <div className="grid grid-cols-1 gap-1.5 text-xs text-muted-foreground mt-2">
                      {project.clients?.name && (
                        <div className="flex items-center gap-2">
                          <Building className="h-3.5 w-3.5 text-muted-foreground/75 shrink-0" />
                          <span className="truncate">{project.clients.name}</span>
                        </div>
                      )}
                      {project.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground/75 shrink-0" />
                          <span className="truncate">{project.location}</span>
                        </div>
                      )}
                      {project.supervising_engineer?.name && (
                        <div className="flex items-center gap-2">
                          <HardHat className="h-3.5 w-3.5 text-muted-foreground/75 shrink-0" />
                          <span className="truncate">{project.supervising_engineer.name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress Section */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">نسبة الإنجاز</span>
                      <span className="font-semibold text-primary font-mono">{project.progress || 0}%</span>
                    </div>
                    <Progress value={project.progress || 0} className="h-2 bg-muted" />
                  </div>

                  {/* Financial Summary */}
                  {!isEngineer && (
                    <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-border/60">
                      <div>
                        <p className="text-muted-foreground mb-0.5">الميزانية</p>
                        <p className="font-bold text-foreground font-mono">{formatCurrencyLYD(project.budget || 0)}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-muted-foreground mb-0.5">إجمالي المصروفات</p>
                        <p className={`font-bold font-mono ${isOverBudget ? "text-destructive" : "text-foreground"}`}>
                          {formatCurrencyLYD(project.spent || 0)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Quick Access Actions */}
                  <div className="flex gap-2 pt-3 border-t border-border/60" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => navigate(`/projects/${project.id}/phases`)}
                      className="flex-1 text-xs cursor-pointer bg-primary text-primary-foreground hover:bg-primary/95"
                    >
                      <Layers className="h-3.5 w-3.5 ml-1.5" />
                      عرض التفاصيل
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="px-2.5 cursor-pointer" title="انتقال سريع">
                          <MoreHorizontal className="h-4 w-4 ml-1" />
                          <span>انتقال سريع</span>
                        </Button>
                      </DropdownMenuTrigger>
                      {renderQuickNavMenu(project.id)}
                    </DropdownMenu>

                    {!isEngineer && (
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => navigate(`/projects/${project.id}/report`)}
                        className="h-8 w-8 cursor-pointer shrink-0"
                        title="طباعة التقرير"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* Collapsible Phases */}
                  <Collapsible
                    open={isExpanded}
                    onOpenChange={() => toggleProject(project.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="pt-1"
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-2 rounded-md hover:bg-accent/40 cursor-pointer">
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        <span>مراحل المشروع</span>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                        {phases.length > 0 ? (
                          phases.map((phase) => (
                            <div
                              key={phase.id}
                              className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/40 hover:bg-accent/50 cursor-pointer transition-colors"
                              onClick={() => navigate(`/projects/${project.id}/phases/${phase.id}/items`)}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusDot[phase.status] || statusDot.pending}`} />
                                <span className="text-xs font-medium truncate">{phase.name}</span>
                              </div>
                              <Badge
                                variant="outline"
                                className={`text-[9px] px-1.5 py-0 shrink-0 border-0 ${statusBadgeClass[phase.status] || ""}`}
                              >
                                {statusLabels[phase.status] || phase.status}
                              </Badge>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-4 bg-muted/20 rounded-md">
                            <p className="text-xs text-muted-foreground">لا توجد مراحل مسجلة</p>
                            {isAdmin && (
                              <Link to={`/projects/${project.id}/phases`} onClick={(e) => e.stopPropagation()}>
                                <span className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1 justify-center cursor-pointer">
                                  <Plus className="h-3 w-3" />
                                  إضافة أول مرحلة
                                </span>
                              </Link>
                            )}
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Structured List/Table View */
        <Card className="shadow-sm overflow-hidden border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="text-right font-bold w-[300px]">المشروع / العميل</TableHead>
                  <TableHead className="text-right font-bold">الموقع</TableHead>
                  <TableHead className="text-right font-bold">المهندس المشرف</TableHead>
                  <TableHead className="text-right font-bold w-[180px]">نسبة الإنجاز</TableHead>
                  {!isEngineer && (
                    <>
                      <TableHead className="text-right font-bold">الميزانية</TableHead>
                      <TableHead className="text-right font-bold">المصروفات</TableHead>
                    </>
                  )}
                  <TableHead className="text-right font-bold">الحالة</TableHead>
                  <TableHead className="text-left font-bold w-[120px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects?.map((project) => {
                  const isOverBudget = !isEngineer && project.budget > 0 && (project.spent || 0) > project.budget;

                  return (
                    <TableRow
                      key={project.id}
                      onClick={() => navigate(`/projects/${project.id}/phases`)}
                      className="cursor-pointer hover:bg-muted/30 transition-colors group"
                    >
                      <TableCell className="font-medium">
                        <div>
                          <p className="font-bold text-foreground group-hover:text-primary transition-colors text-sm">
                            {project.name}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Building className="h-3 w-3 shrink-0" />
                            {project.clients?.name || "عميل غير محدد"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {project.location ? (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span>{project.location}</span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {project.supervising_engineer?.name ? (
                          <div className="flex items-center gap-1">
                            <HardHat className="h-3.5 w-3.5 shrink-0" />
                            <span>{project.supervising_engineer.name}</span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 max-w-[160px]">
                          <Progress value={project.progress || 0} className="h-2 flex-1 bg-muted" />
                          <span className="text-xs font-bold font-mono text-primary">{project.progress || 0}%</span>
                        </div>
                      </TableCell>
                      {!isEngineer && (
                        <>
                          <TableCell className="font-mono text-xs font-semibold">
                            {formatCurrencyLYD(project.budget || 0)}
                          </TableCell>
                          <TableCell className="font-mono text-xs font-semibold">
                            <span className={isOverBudget ? "text-destructive font-bold flex items-center gap-1" : "text-foreground"}>
                              {formatCurrencyLYD(project.spent || 0)}
                              {isOverBudget && <AlertTriangle className="h-3.5 w-3.5 shrink-0 animate-bounce" title="تجاوز الميزانية!" />}
                            </span>
                          </TableCell>
                        </>
                      )}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-2 py-0.5 border ${statusBadgeClass[project.status] || ""}`}
                        >
                          <span className={`h-1 w-1 rounded-full ${statusDot[project.status]} ml-1`} />
                          {statusLabels[project.status] || project.status}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1.5">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8 px-2 cursor-pointer gap-1">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                                <span className="text-xs">انتقال</span>
                              </Button>
                            </DropdownMenuTrigger>
                            {renderQuickNavMenu(project.id)}
                          </DropdownMenu>

                          {!isEngineer && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/projects/${project.id}/report`)}
                              className="h-8 w-8 cursor-pointer"
                              title="طباعة التقرير"
                            >
                              <Printer className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Projects;
