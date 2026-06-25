import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { TaskTotalCostSummary } from '@/components/tasks/TaskTotalCostSummary';
import { supabase } from '@/integrations/supabase/client';
import { 
  Calculator, Coins, Wrench, Landmark, LayoutGrid, Building2,
  DollarSign, Clock, CheckCircle2, AlertCircle, Calendar, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface AllInstallationsSummaryProps {
  siblingTasks: any[];
  currentTaskId: string;
  billboards: Record<number, any>;
  installationPrices: Record<number, number>;
  onRefresh: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  completed: { label: 'مكتملة', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
  in_progress: { label: 'قيد التنفيذ', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
  pending: { label: 'جديدة', color: 'bg-slate-500/15 text-slate-400 border-slate-500/30', dot: 'bg-slate-400' },
  cancelled: { label: 'ملغاة', color: 'bg-red-500/15 text-red-400 border-red-500/30', dot: 'bg-red-400' },
};

export const AllInstallationsSummary: React.FC<AllInstallationsSummaryProps> = ({
  siblingTasks,
  currentTaskId,
  billboards,
  installationPrices,
  onRefresh,
}) => {
  const [taskItemsMap, setTaskItemsMap] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAllItems = useCallback(async () => {
    if (!siblingTasks || siblingTasks.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const taskIds = siblingTasks.map(t => t.id);
      const { data, error: dbError } = await supabase
        .from('installation_task_items')
        .select('*')
        .in('task_id', taskIds);

      if (dbError) throw dbError;

      // Group by task_id
      const grouped: Record<string, any[]> = {};
      taskIds.forEach(id => {
        grouped[id] = [];
      });
      if (data) {
        data.forEach(item => {
          if (grouped[item.task_id]) {
            grouped[item.task_id].push(item);
          } else {
            grouped[item.task_id] = [item];
          }
        });
      }
      setTaskItemsMap(grouped);
    } catch (err: any) {
      console.error('Error fetching sibling task items:', err);
      setError(err.message || 'فشل في تحميل تفاصيل اللوحات');
    } finally {
      setLoading(false);
    }
  }, [siblingTasks]);

  useEffect(() => {
    fetchAllItems();
  }, [fetchAllItems]);

  const handleRefresh = useCallback(() => {
    fetchAllItems();
    onRefresh();
  }, [fetchAllItems, onRefresh]);

  // Calculate totals and breakdown
  const overallTotals = useMemo(() => {
    let companyTotal = 0;
    let customerTotal = 0;
    let countTotal = 0;

    const breakdown = siblingTasks.map(t => {
      const items = taskItemsMap[t.id] || [];
      let taskCompany = 0;
      let taskCustomer = 0;

      items.forEach(item => {
        const billboard = billboards[item.billboard_id];
        const totalFaces = billboard?.Faces_Count || 1;
        const facesToInstall = item.faces_to_install ?? totalFaces;
        const hasCompanyCost = item.company_installation_cost !== null && item.company_installation_cost !== undefined;
        const basicCompanyCost = hasCompanyCost
          ? item.company_installation_cost!
          : (() => {
              const fullCompanyCost = installationPrices[item.billboard_id] || 0;
              return (totalFaces > 1 && facesToInstall === 1) ? fullCompanyCost / 2 : fullCompanyCost;
            })();
        taskCompany += basicCompanyCost + (item.company_additional_cost || 0);
        const isReinstalled = (item.reinstall_count || 0) > 0;
        const itemCustomerCost = isReinstalled
          ? (item.customer_original_install_cost || 0) + (item.customer_reinstall_cost || item.customer_installation_cost || 0)
          : (item.customer_installation_cost || 0);
        taskCustomer += itemCustomerCost + (item.additional_cost || 0);
      });

      companyTotal += taskCompany;
      customerTotal += taskCustomer;
      countTotal += items.length;

      return {
        taskId: t.id,
        taskName: t.task_name,
        taskType: t.task_type,
        reinstallationNumber: t.reinstallation_number,
        companyCost: taskCompany,
        customerCost: taskCustomer,
        profit: taskCustomer - taskCompany,
        itemsCount: items.length,
        status: t.status,
        date: t.created_at,
        teamName: t.installation_teams?.team_name
      };
    });

    return {
      companyTotal,
      customerTotal,
      profitTotal: customerTotal - companyTotal,
      countTotal,
      breakdown
    };
  }, [siblingTasks, taskItemsMap, billboards, installationPrices]);

  if (loading && Object.keys(taskItemsMap).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-card border border-border rounded-xl space-y-3" dir="rtl">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">جاري تحميل بيانات جميع مرات التركيب...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm text-right flex items-center gap-2" dir="rtl">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* ── OVERALL SUMMARY CARD ── */}
      <Card className="overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-card to-primary/[0.02]">
        <CardHeader className="py-4 px-5 border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Calculator className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-bold text-foreground">
                ملخص إجمالي لجميع مرات التركيب ({siblingTasks.length})
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 font-bold">
              العقد بالكامل
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-5">
          {/* Main Totals Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-muted/40 border border-border/40 shadow-sm transition-all hover:bg-muted/60">
              <div className="text-2xl font-black text-foreground font-mono">
                {overallTotals.companyTotal.toLocaleString('ar-LY')}
              </div>
              <div className="text-xs font-semibold text-muted-foreground/90 mt-1">تكلفة الشركة الإجمالية</div>
            </div>

            <div className="p-4 rounded-xl bg-primary/5 border border-primary/15 shadow-sm transition-all hover:bg-primary/10">
              <div className="text-2xl font-black text-primary font-mono">
                {overallTotals.customerTotal.toLocaleString('ar-LY')}
              </div>
              <div className="text-xs font-semibold text-primary/80 mt-1">سعر الزبون الإجمالي</div>
            </div>

            <div className={cn(
              "p-4 rounded-xl border shadow-sm transition-all",
              overallTotals.profitTotal >= 0 
                ? "bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10 text-emerald-600" 
                : "bg-destructive/5 border-destructive/20 hover:bg-destructive/10 text-destructive"
            )}>
              <div className="text-2xl font-black font-mono">
                {overallTotals.profitTotal >= 0 ? '+' : ''}
                {overallTotals.profitTotal.toLocaleString('ar-LY')}
              </div>
              <div className="text-xs font-semibold text-muted-foreground/90 mt-1">صافي الربح الإجمالي</div>
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border border-border/40 shadow-sm transition-all hover:bg-muted/60">
              <div className="text-2xl font-black text-foreground font-mono">
                {overallTotals.countTotal}
              </div>
              <div className="text-xs font-semibold text-muted-foreground/90 mt-1">إجمالي اللوحات المجهّزة</div>
            </div>
          </div>

          <Separator className="bg-border/60" />

          {/* Iterations mini-breakdown timeline/table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">جدول تفصيلي بالمرات</h4>
            <div className="overflow-x-auto rounded-xl border border-border/50 bg-background/50">
              <table className="w-full text-sm text-right border-collapse">
                <thead>
                  <tr className="bg-muted/40 text-muted-foreground font-semibold text-xs border-b border-border/40">
                    <th className="p-2.5 font-bold">المرة</th>
                    <th className="p-2.5 font-bold">اسم المهمة</th>
                    <th className="p-2.5 font-bold">الفريق</th>
                    <th className="p-2.5 font-bold text-left">التكلفة</th>
                    <th className="p-2.5 font-bold text-left">سعر الزبون</th>
                    <th className="p-2.5 font-bold text-left">الربح</th>
                    <th className="p-2.5 font-bold">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {overallTotals.breakdown.map((item, index) => {
                    const isRe = item.taskType === 'reinstallation';
                    const label = isRe 
                      ? `إعادة تركيب #${item.reinstallationNumber || 1}` 
                      : 'التركيبة الأولى';
                    const statusCfg = STATUS_CONFIG[item.status || 'pending'];
                    const isCurrent = item.taskId === currentTaskId;

                    return (
                      <tr 
                        key={item.taskId} 
                        className={cn(
                          "transition-colors hover:bg-muted/20",
                          isCurrent && "bg-primary/[0.03] font-medium"
                        )}
                      >
                        <td className="p-2.5 flex items-center gap-1.5">
                          {isCurrent && <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
                          <span className={cn(isCurrent && "text-primary font-bold")}>{label}</span>
                        </td>
                        <td className="p-2.5 text-muted-foreground font-semibold max-w-[150px] truncate">
                          {item.taskName || '-'}
                        </td>
                        <td className="p-2.5 text-muted-foreground text-xs">
                          {item.teamName || '-'}
                        </td>
                        <td className="p-2.5 text-left font-mono font-medium">{item.companyCost.toLocaleString('ar-LY')}</td>
                        <td className="p-2.5 text-left font-mono font-medium text-primary">{item.customerCost.toLocaleString('ar-LY')}</td>
                        <td className={cn(
                          "p-2.5 text-left font-mono font-bold",
                          item.profit >= 0 ? "text-emerald-600" : "text-destructive"
                        )}>
                          {item.profit >= 0 ? '+' : ''}{item.profit.toLocaleString('ar-LY')}</td>
                        <td className="p-2.5">
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-bold", statusCfg?.color)}>
                            {statusCfg?.label || 'جديدة'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── ACCORDION LIST OF SEPARATE COST SUMMARIES ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Wrench className="h-4.5 w-4.5 text-primary" />
          <h3 className="text-sm font-bold text-foreground">قائمة تكاليف كل مرة على حدة</h3>
        </div>

        <Accordion type="single" collapsible defaultValue={currentTaskId} className="w-full space-y-3">
          {siblingTasks.map((t) => {
            const isRe = t.task_type === 'reinstallation';
            const label = isRe 
              ? `إعادة تركيب #${t.reinstallation_number || 1}` 
              : 'التركيبة الأولى';
            const statusCfg = STATUS_CONFIG[t.status || 'pending'];
            const items = taskItemsMap[t.id] || [];
            
            // Calculate task specific values for header
            let taskCompany = 0;
            let taskCustomer = 0;
            items.forEach(item => {
              const billboard = billboards[item.billboard_id];
              const totalFaces = billboard?.Faces_Count || 1;
              const facesToInstall = item.faces_to_install ?? totalFaces;
              const hasCompanyCost = item.company_installation_cost !== null && item.company_installation_cost !== undefined;
              const basicCompanyCost = hasCompanyCost
                ? item.company_installation_cost!
                : (() => {
                    const fullCompanyCost = installationPrices[item.billboard_id] || 0;
                    return (totalFaces > 1 && facesToInstall === 1) ? fullCompanyCost / 2 : fullCompanyCost;
                  })();
              taskCompany += basicCompanyCost + (item.company_additional_cost || 0);
              const isReinstalled = (item.reinstall_count || 0) > 0;
              const customerCost = isReinstalled
                ? (Number(item.customer_original_install_cost) || 0) + (Number(item.customer_reinstall_cost) || Number(item.customer_installation_cost) || 0)
                : (item.customer_installation_cost || 0);
              taskCustomer += customerCost + (item.additional_cost || 0);
            });

            const isCurrent = t.id === currentTaskId;

            return (
              <AccordionItem 
                value={t.id} 
                key={t.id} 
                className={cn(
                  "border border-border/80 rounded-xl overflow-hidden bg-card transition-all shadow-sm",
                  isCurrent ? "border-primary/40 ring-1 ring-primary/10 shadow-primary/5" : "hover:border-border-hover"
                )}
              >
                <AccordionTrigger className={cn(
                  "px-4 py-3.5 hover:no-underline hover:bg-muted/10 transition-colors flex items-center justify-between w-full text-right gap-3 [&[data-state=open]>svg]:rotate-180",
                  isCurrent && "bg-primary/[0.02]"
                )}>
                  <div className="flex flex-1 items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-bold text-right", isCurrent ? "text-primary" : "text-foreground")}>
                        {label}
                      </span>
                      {t.task_name && (
                        <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-lg max-w-[120px] truncate" title={t.task_name}>
                          {t.task_name}
                        </span>
                      )}
                      {isCurrent && (
                        <Badge variant="secondary" className="bg-primary/15 text-primary text-[10px] font-black border border-primary/25">
                          المهمة المعروضة حالياً
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground/80 pl-2">
                      <span>اللوحات: <strong className="text-foreground">{items.length}</strong></span>
                      <span className="text-muted-foreground/35">|</span>
                      <span>سعر الزبون: <strong className="text-primary font-bold">{taskCustomer.toLocaleString('ar-LY')}</strong></span>
                      <span className="text-muted-foreground/35">|</span>
                      <span>الربح: <strong className={cn(taskCustomer - taskCompany >= 0 ? "text-emerald-600" : "text-destructive")}>
                        {(taskCustomer - taskCompany).toLocaleString('ar-LY')}
                      </strong></span>
                      <span className="text-muted-foreground/35">|</span>
                      <span className={cn("px-2 py-0.5 rounded-full border font-bold text-[9px]", statusCfg?.color)}>
                        {statusCfg?.label || 'جديدة'}
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="p-4 pt-0 border-t border-border/40">
                  <div className="mt-4">
                    <TaskTotalCostSummary
                      taskId={t.id}
                      taskItems={items}
                      installationPrices={installationPrices}
                      billboards={billboards}
                      onRefresh={handleRefresh}
                      taskType={t.task_type}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </div>
  );
};
