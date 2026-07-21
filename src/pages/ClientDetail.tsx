import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState } from "react";
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
  Building,
  FolderOpen,
  FileText,
  DollarSign,
  Printer,
  Calendar,
  Wallet,
  ArrowUpRight,
  Coins,
  Plus,
} from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { openPrintWindow } from "@/lib/printStyles";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Client = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
};

type Project = {
  id: string;
  name: string;
  project_type: string;
  client_id: string;
  description: string | null;
  status: string;
  budget: number;
  spent: number;
};

type Phase = {
  id: string;
  project_id: string;
  name: string;
  phase_number: number | null;
  reference_number: string | null;
  has_percentage: boolean;
  percentage_value: number;
  created_at: string;
};

type ProjectItem = {
  id: string;
  phase_id: string;
  total_price: number;
};

type Purchase = {
  id: string;
  phase_id: string;
  total_amount: number;
  rental_id: string | null;
};

type ClientPayment = {
  id: string;
  amount: number;
  date: string;
  payment_method: string;
  notes: string | null;
  project_id: string | null;
  treasuries?: {
    name: string;
  } | null;
};

type Contract = {
  id: string;
  title: string;
  contract_number: string;
  status: string;
  amount: number;
  start_date: string;
};

type Treasury = {
  id: string;
  name: string;
  treasury_type: string;
  parent_id: string | null;
  balance: number;
};

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  active: "نشط",
  completed: "مكتمل",
  cancelled: "ملغي",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500",
  active: "bg-green-500/10 text-green-500",
  completed: "bg-blue-500/10 text-blue-500",
  cancelled: "bg-red-500/10 text-red-500",
};

const methodLabels: Record<string, string> = {
  cash: "نقدي (كاش)",
  cheque: "صك مصرفي",
  transfer: "تحويل مصرفي",
};

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  // Add payment states
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [selectedParentTreasuryId, setSelectedParentTreasuryId] = useState("");
  const [selectedTreasuryId, setSelectedTreasuryId] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch company settings for printing
  const { data: companySettings } = useQuery({
    queryKey: ["company-settings-client-detail"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch client details
  const { data: client, isLoading: clientLoading } = useQuery<Client | null>({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch client projects
  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["client-projects", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("client_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch client contracts
  const { data: contracts } = useQuery<Contract[]>({
    queryKey: ["client-contracts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .eq("client_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch client payments with treasury names
  const { data: payments } = useQuery<ClientPayment[]>({
    queryKey: ["client-payments-list", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_payments")
        .select("id, amount, date, payment_method, notes, project_id, treasuries(name)")
        .eq("client_id", id!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  // Fetch active treasuries
  const { data: treasuries } = useQuery<Treasury[]>({
    queryKey: ["treasuries-active-client-detail"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasuries")
        .select("id, name, treasury_type, parent_id, balance")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Split parent and child treasuries
  const parentTreasuries = useMemo(() => {
    return treasuries?.filter((t) => t.parent_id === null) || [];
  }, [treasuries]);

  const filteredChildTreasuries = useMemo(() => {
    if (!selectedParentTreasuryId || !treasuries) return [];
    let list = treasuries.filter((t) => t.parent_id === selectedParentTreasuryId);
    if (paymentMethod === "cash") {
      list = list.filter((t) => t.treasury_type === "cash");
    } else {
      list = list.filter((t) => t.treasury_type === "bank");
    }
    return list;
  }, [treasuries, selectedParentTreasuryId, paymentMethod]);

  // Fetch other related data for billing calculations
  const { data: phases } = useQuery<Phase[]>({
    queryKey: ["client-phases", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_phases").select("*");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: projectItems } = useQuery<ProjectItem[]>({
    queryKey: ["client-items", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_items").select("id, phase_id, total_price");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: purchases } = useQuery<Purchase[]>({
    queryKey: ["client-purchases", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchases").select("id, phase_id, total_amount, rental_id");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Add Payment Mutation
  const addPaymentMutation = useMutation({
    mutationFn: async () => {
      const amt = Number(paymentAmount);
      if (amt <= 0) {
        throw new Error("يجب إدخال قيمة صحيحة للمبلغ");
      }
      if (!selectedTreasuryId) {
        throw new Error("يجب اختيار الخزينة المستلمة");
      }

      // 1. Insert Client Payment
      const { data: payment, error: payErr } = await supabase
        .from("client_payments")
        .insert({
          client_id: id!,
          project_id: null,
          amount: amt,
          date: paymentDate,
          payment_method: paymentMethod,
          treasury_id: selectedTreasuryId,
          notes: notes || null,
        })
        .select("id")
        .single();
      if (payErr) throw payErr;

      // 2. Insert Income Log
      const { error: incErr } = await supabase
        .from("income")
        .insert({
          project_id: null,
          client_id: id!,
          amount: amt,
          date: paymentDate,
          type: "service",
          subtype: "client_payment",
          payment_method: paymentMethod,
          notes: notes || `تسديد دفعة عامة (رصيد زبون)`,
          status: "received",
          reference_id: payment.id,
        });
      if (incErr) throw incErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client", id] });
      queryClient.invalidateQueries({ queryKey: ["client-projects", id] });
      queryClient.invalidateQueries({ queryKey: ["client-payments-list", id] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["all-clients-debts"] });
      queryClient.invalidateQueries({ queryKey: ["treasuries-active-client-detail"] });
      queryClient.invalidateQueries({ queryKey: ["treasuries-active"] });
      toast.success("تم تسجيل الدفعة وإضافتها للخزينة بنجاح");
      setPaymentDialogOpen(false);
      setPaymentAmount("");
      setNotes("");
      setSelectedParentTreasuryId("");
      setSelectedTreasuryId("");
    },
    onError: (err: any) => {
      toast.error(err.message || "حدث خطأ أثناء تسجيل الدفعة");
    },
  });

  const handleAddPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addPaymentMutation.mutate();
  };

  // Calculate detailed financial totals
  const clientFinancials = useMemo(() => {
    if (!projects || !phases || !projectItems || !purchases || !payments) {
      return { totalBilled: 0, totalPaid: 0, remaining: 0, projectBills: {} as Record<string, number> };
    }

    let totalBilled = 0;
    const projectBills: Record<string, number> = {};

    projects.forEach((proj) => {
      const projItems = projectItems.filter((item) => item.project_id === proj.id);
      const projPurchases = purchases.filter((p) => p.project_id === proj.id && p.rental_id === null);
      const projRentals = purchases.filter((p) => p.project_id === proj.id && p.rental_id !== null);

      const itemsSum = projItems.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
      const purchSum = projPurchases.reduce((sum, p) => sum + Number(p.total_amount || 0), 0);
      const rentSum = projRentals.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);

      let percentageFeeSum = 0;
      const allProjPurchasesAndRentals = purchases.filter((p) => p.project_id === proj.id);
      allProjPurchasesAndRentals.forEach((p) => {
        let pct = 0;
        if (p.phase_id) {
          const phase = phases.find((ph) => ph.id === p.phase_id);
          if (phase) {
            pct = phase.has_percentage && phase.percentage_value > 0 
              ? Number(phase.percentage_value) 
              : (proj.project_type === "finishing" ? Number(proj.finishing_percentage || 0) : 0);
          } else {
            pct = proj.project_type === "finishing" ? Number(proj.finishing_percentage || 0) : 0;
          }
        } else {
          pct = proj.project_type === "finishing" ? Number(proj.finishing_percentage || 0) : 0;
        }
        
        if (pct > 0) {
          percentageFeeSum += (Number(p.total_amount || 0) * pct) / 100;
        }
      });

      const projectTotal = itemsSum + purchSum + rentSum + percentageFeeSum;
      projectBills[proj.id] = projectTotal;
      totalBilled += projectTotal;
    });

    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const remaining = totalBilled - totalPaid;

    return {
      totalBilled,
      totalPaid,
      remaining,
      projectBills,
    };
  }, [projects, phases, projectItems, purchases, payments]);

  // Print Payment Receipt (إيصال قبض)
  const handlePrintReceipt = async (payment: any) => {
    // 1. Fetch allocations for this payment on the fly
    const { data: paymentAllocs } = await supabase
      .from("client_payment_allocations")
      .select("id, payment_id, reference_id, reference_type, amount, phase_id, phase:phase_id(name)")
      .eq("payment_id", payment.id);

    // 2. Fetch referenced purchases/items
    const refIds = paymentAllocs?.map(a => a.reference_id) || [];
    let refPurchases: any[] = [];
    let refItems: any[] = [];

    if (refIds.length > 0) {
      const { data: purData } = await supabase
        .from("purchases")
        .select("id, invoice_number, suppliers:supplier_id(name)")
        .in("id", refIds);
      refPurchases = purData || [];

      const { data: itemData } = await supabase
        .from("project_items")
        .select("id, name")
        .in("id", refIds);
      refItems = itemData || [];
    }

    const clientName = client?.name || "بدون عميل";
    const companyName = companySettings?.company_name || "شركة الفارس الذهبي للدعاية";
    const dateStr = format(new Date(payment.date), "dd/MM/yyyy");

    // Find linked project name if exists
    let matchedProjectName = "رصيد عام للزبون";
    if (payment.project_id) {
      const proj = projects?.find((p) => p.id === payment.project_id);
      if (proj) matchedProjectName = proj.name;
    }

    const borderStyle = `border: ${companySettings?.print_border_width ?? 1}px solid ${companySettings?.print_table_border_color || "#ccc"};`;

    const contentHtml = `
      <div class="print-area" style="box-shadow: none; margin: 0; padding: 20px; direction: rtl;">
        <!-- Header -->
        <div class="print-report-header" style="text-align: center; margin-bottom: 25px; border-bottom: 2px solid ${companySettings?.print_section_title_color || '#7A5A10'}; padding-bottom: 12px;">
          <div class="print-report-company" style="font-size: 20pt; font-weight: bold; color: ${companySettings?.print_section_title_color || '#7A5A10'}; font-family: 'Cairo', sans-serif;">${companyName}</div>
          <div class="print-report-title" style="font-size: 14pt; font-weight: bold; margin-top: 5px; font-family: 'Cairo', sans-serif;">إيصال قبض مالي (Payment Receipt)</div>
          <div class="print-report-meta" style="font-size: 10pt; color: #666; margin-top: 5px; font-family: 'Cairo', sans-serif;">
            رقم الإيصال: ${payment.id.split('-')[0].toUpperCase()} &nbsp;|&nbsp; التاريخ: ${dateStr}
          </div>
        </div>

        <!-- Info Table -->
        <div class="print-section" style="margin-bottom: 20px; font-family: 'Cairo', sans-serif;">
          <table class="print-info-table" style="width: 100%; border-collapse: collapse; margin-top: 10px; ${borderStyle}">
            <tbody>
              <tr>
                <td class="info-label" style="font-weight: bold; background-color: ${companySettings?.print_table_header_color || '#B4A078'}; color: ${companySettings?.print_header_text_color || '#ffffff'}; padding: 8px; ${borderStyle} width: 25%;">استلمنا من السيد / السادة</td>
                <td class="info-value" colspan="3" style="padding: 8px; ${borderStyle}">${clientName}</td>
              </tr>
              <tr>
                <td class="info-label" style="font-weight: bold; background-color: ${companySettings?.print_table_header_color || '#B4A078'}; color: ${companySettings?.print_header_text_color || '#ffffff'}; padding: 8px; ${borderStyle}">وذلك عن مشروع</td>
                <td class="info-value" colspan="3" style="padding: 8px; ${borderStyle}">${matchedProjectName}</td>
              </tr>
              <tr>
                <td class="info-label" style="font-weight: bold; background-color: ${companySettings?.print_table_header_color || '#B4A078'}; color: ${companySettings?.print_header_text_color || '#ffffff'}; padding: 8px; ${borderStyle}">مبلـغ وقدره</td>
                <td class="info-value" style="padding: 8px; ${borderStyle} font-weight: bold; font-size: 13pt; color: #15803d; font-family: 'Cairo', sans-serif;">${payment.amount.toLocaleString()} د.ل</td>
                <td class="info-label" style="font-weight: bold; background-color: ${companySettings?.print_table_header_color || '#B4A078'}; color: ${companySettings?.print_header_text_color || '#ffffff'}; padding: 8px; ${borderStyle} width: 15%;">طريقة الدفع</td>
                <td class="info-value" style="padding: 8px; ${borderStyle} width: 25%;">
                  ${payment.payment_method === 'cash' ? 'نقداً (كاش)' : payment.payment_method === 'cheque' ? 'شيك مصرفي' : 'تحويل بنكي'}
                </td>
              </tr>
              ${payment.notes ? `
              <tr>
                <td class="info-label" style="font-weight: bold; background-color: ${companySettings?.print_table_header_color || '#B4A078'}; color: ${companySettings?.print_header_text_color || '#ffffff'}; padding: 8px; ${borderStyle}">ملاحظات / البيان</td>
                <td class="info-value" colspan="3" style="padding: 8px; ${borderStyle}">${payment.notes}</td>
              </tr>
              ` : ''}
            </tbody>
          </table>
        </div>

        <!-- Allocations table if available -->
        ${(() => {
          if (!paymentAllocs || paymentAllocs.length === 0) return '';
          
          const processedAllocs = paymentAllocs.map(alloc => {
            const purchase = refPurchases?.find(p => p.id === alloc.reference_id);
            const item = refItems?.find(i => i.id === alloc.reference_id);
            const phaseName = alloc.phase?.name || '';
            const desc = alloc.reference_type === 'purchase' 
              ? `شراء: ${purchase?.invoice_number ? `فاتورة رقم ${purchase.invoice_number}` : 'مشتريات'}` 
              : alloc.reference_type === 'rental' 
                ? 'إيجار معدات' 
                : `بند: ${item?.name || 'بند مقاولات'}`;
            
            return {
              desc,
              phaseName,
              amount: Number(alloc.amount)
            };
          });

          return `
          <div class="print-section" style="margin-bottom: 25px; font-family: 'Cairo', sans-serif;">
            <div class="print-section-title" style="font-weight: bold; font-size: 12pt; color: ${companySettings?.print_section_title_color || '#7A5A10'}; border-bottom: 1.5px solid ${companySettings?.print_section_title_color || '#7A5A10'}; padding-bottom: 4px; margin-bottom: 8px;">تسوية وتوزيع الدفعة على المستندات:</div>
            <table class="print-table" style="width: 100%; border-collapse: collapse; text-align: right; ${borderStyle}">
              <thead>
                <tr style="background-color: ${companySettings?.print_table_header_color || '#B4A078'}; color: ${companySettings?.print_header_text_color || '#ffffff'};">
                  <th style="padding: 8px; ${borderStyle}">التفاصيل / المستند</th>
                  <th style="padding: 8px; ${borderStyle}">المرحلة</th>
                  <th style="padding: 8px; ${borderStyle} text-align: left;">المبلغ المستقطع</th>
                </tr>
              </thead>
              <tbody>
                ${processedAllocs.map(r => `
                  <tr>
                    <td style="padding: 8px; ${borderStyle}">${r.desc}</td>
                    <td style="padding: 8px; ${borderStyle}">${r.phaseName || "-"}</td>
                    <td style="padding: 8px; ${borderStyle} text-align: left; font-weight: bold; font-family: 'Cairo', sans-serif;">${r.amount.toLocaleString()} د.ل</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
          `;
        })()}

        <!-- Signatures -->
        <div style="margin-top: 60px; display: flex; justify-content: space-between; padding: 0 40px; font-family: 'Cairo', sans-serif;">
          <div style="text-align: center; width: 220px;">
            <p style="font-weight: bold; margin-bottom: 50px;">توقيع المستلم</p>
            <p style="border-top: 1px dotted #555; width: 100%;"></p>
          </div>
          <div style="text-align: center; width: 220px;">
            <p style="font-weight: bold; margin-bottom: 50px;">توقيع ومصادقة الجهة</p>
            <p style="border-top: 1px dotted #555; width: 100%;"></p>
          </div>
        </div>
      </div>
    `;

    const windowTitle = `إيصال قبض - رقم ${payment.id.split('-')[0].toUpperCase()} - ${clientName}`;
    
    // Force header settings for plain paper receipt printing
    const printSettings = companySettings ? {
      ...companySettings,
      print_header_enabled: true,
      print_footer_enabled: true,
    } : null;

    openPrintWindow(windowTitle, contentHtml, printSettings);
  };

  // Print Account Statement
  const handlePrintStatement = () => {
    if (!client) return;

    const dateStr = format(new Date(), "yyyy/MM/dd", { locale: ar });
    
    // Project billing list
    let projectBillsHTML = "";
    projects?.forEach((p) => {
      const billAmount = clientFinancials.projectBills[p.id] || 0;
      projectBillsHTML += `
        <tr>
          <td>${p.name}</td>
          <td style="text-align: center;">${p.project_type === "contracting" ? "مقاولات" : "تشطيبات"}</td>
          <td style="text-align: center;">${statusLabels[p.status] || p.status}</td>
          <td style="text-align: center; font-weight: bold;">${billAmount.toLocaleString()} د.ل</td>
        </tr>
      `;
    });

    // Payments list
    let paymentsHTML = "";
    payments?.forEach((p, idx) => {
      paymentsHTML += `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td style="text-align: center;">${format(new Date(p.date), "yyyy/MM/dd")}</td>
          <td style="text-align: center; font-weight: bold; color: green;">${p.amount.toLocaleString()} د.ل</td>
          <td style="text-align: center;">${methodLabels[p.payment_method] || p.payment_method}</td>
          <td>${p.treasuries?.name || "---"}</td>
          <td>${p.notes || "---"}</td>
        </tr>
      `;
    });

    const printHTML = `
      <style>
        .statement-container {
          direction: rtl;
          font-family: 'Cairo', sans-serif;
          color: #000;
        }
        .header-section {
          text-align: center;
          margin-bottom: 25px;
          border-bottom: 2px solid #000;
          padding-bottom: 15px;
        }
        .client-info-table {
          width: 100%;
          margin-bottom: 25px;
        }
        .client-info-table td {
          padding: 5px;
          font-size: 11pt;
        }
        .summary-box {
          display: flex;
          justify-content: space-around;
          background-color: #f8f9fa;
          border: 1px solid #ddd;
          padding: 15px;
          margin-bottom: 25px;
          border-radius: 8px;
        }
        .summary-item {
          text-align: center;
        }
        .summary-value {
          font-size: 14pt;
          font-weight: bold;
          margin-top: 5px;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 25px;
        }
        .data-table th, .data-table td {
          border: 1px solid #000;
          padding: 8px;
          font-size: 10pt;
        }
        .data-table th {
          background-color: #f2f2f2;
          font-weight: bold;
        }
      </style>
      <div class="statement-container">
        <div class="header-section">
          <h2>كشف حساب تفصيلي للعميل</h2>
          <p>التاريخ: ${dateStr}</p>
        </div>

        <table class="client-info-table">
          <tr>
            <td style="width: 15%; font-weight: bold;">اسم العميل:</td>
            <td>${client.name}</td>
            <td style="width: 15%; font-weight: bold;">رقم الهاتف:</td>
            <td>${client.phone || "---"}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">المدينة/العنوان:</td>
            <td>${client.city || "---"} - ${client.address || "---"}</td>
            <td style="font-weight: bold;">البريد الإلكتروني:</td>
            <td>${client.email || "---"}</td>
          </tr>
        </table>

        <div class="summary-box">
          <div class="summary-item">
            <div>إجمالي الأعمال والبنود</div>
            <div class="summary-value" style="color: #000;">${clientFinancials.totalBilled.toLocaleString()} د.ل</div>
          </div>
          <div class="summary-item">
            <div>إجمالي المسدد</div>
            <div class="summary-value" style="color: green;">${clientFinancials.totalPaid.toLocaleString()} د.ل</div>
          </div>
          <div class="summary-item">
            <div>القيمة المتبقية المستحقة</div>
            <div class="summary-value" style="color: ${clientFinancials.remaining > 0 ? "red" : "green"};">
              ${clientFinancials.remaining.toLocaleString()} د.ل
            </div>
          </div>
        </div>

        <h3 style="border-bottom: 1px solid #ddd; padding-bottom: 5px;">كشف الأعمال والمشاريع</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>اسم المشروع</th>
              <th style="width: 18%;">نوع المشروع</th>
              <th style="width: 18%;">حالة المشروع</th>
              <th style="width: 25%;">قيمة الأعمال المنجزة</th>
            </tr>
          </thead>
          <tbody>
            ${projectBillsHTML || `<tr><td colspan="4" style="text-align: center;">لا توجد مشاريع مسجلة</td></tr>`}
          </tbody>
        </table>

        <h3 style="border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-top: 25px;">جدول الدفعات والتسديدات</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 6%;">ر.م</th>
              <th style="width: 15%;">تاريخ السداد</th>
              <th style="width: 20%;">قيمة الدفعة</th>
              <th style="width: 18%;">طريقة الدفع</th>
              <th style="width: 20%;">الخزينة/الحساب المستلم</th>
              <th>ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${paymentsHTML || `<tr><td colspan="6" style="text-align: center;">لا توجد دفعات مسجلة</td></tr>`}
          </tbody>
        </table>
      </div>
    `;

    // Force header/footer enabled for plain paper statement printing
    const printSettings = companySettings ? {
      ...companySettings,
      print_header_enabled: true,
      print_footer_enabled: true,
    } : null;

    openPrintWindow(`كشف حساب - ${client.name}`, printHTML, printSettings);
  };

  if (clientLoading || projectsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12" dir="rtl">
        <p className="text-muted-foreground">العميل غير موجود</p>
        <Link to="/clients">
          <Button variant="link">العودة للعملاء</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Breadcrumb & Print */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/clients" className="hover:text-foreground">
            العملاء
          </Link>
          <ArrowRight className="h-4 w-4 rotate-180" />
          <span className="text-foreground">{client.name}</span>
        </div>
        <div className="flex gap-2">
          <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 cursor-pointer bg-green-600 hover:bg-green-700 text-white font-bold">
                <Plus className="h-4 w-4" />
                <span>إضافة دفعة سداد</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-background" dir="rtl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
                  <Wallet className="h-5 w-5 text-primary" />
                  <span>تسجيل دفعة سداد للزبون</span>
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddPaymentSubmit} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="pay-amount">قيمة الدفعة (د.ل) *</Label>
                  <Input
                    id="pay-amount"
                    type="number"
                    step="0.01"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00 د.ل"
                    className="text-lg font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pay-date">تاريخ القبض والسداد *</Label>
                  <Input
                    id="pay-date"
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>طريقة الدفع *</Label>
                    <Select
                      value={paymentMethod}
                      onValueChange={(val) => {
                        setPaymentMethod(val);
                        setSelectedTreasuryId("");
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">نقداً (كاش)</SelectItem>
                        <SelectItem value="cheque">صك مصرفي</SelectItem>
                        <SelectItem value="transfer">تحويل بنكي</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 col-span-2">
                    <Label>القسم / الخزينة العامة *</Label>
                    <Select
                      value={selectedParentTreasuryId}
                      onValueChange={(val) => {
                        setSelectedParentTreasuryId(val);
                        setSelectedTreasuryId("");
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="اختر القسم..." />
                      </SelectTrigger>
                      <SelectContent>
                        {parentTreasuries.map((pt) => (
                          <SelectItem key={pt.id} value={pt.id}>
                            {pt.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>الخزينة أو الحساب المستلم الفرعي *</Label>
                  <Select
                    value={selectedTreasuryId}
                    onValueChange={setSelectedTreasuryId}
                    disabled={!selectedParentTreasuryId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={selectedParentTreasuryId ? "اختر الحساب الفرعي..." : "حدد القسم أولاً"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredChildTreasuries.map((ct) => (
                        <SelectItem key={ct.id} value={ct.id}>
                          {ct.name} ({ct.treasury_type === 'cash' ? 'نقدي' : 'بنك'}) - رصيد: {ct.balance.toLocaleString()} د.ل
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pay-notes">ملاحظات / البيان</Label>
                  <Textarea
                    id="pay-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="اكتب ملاحظات السداد أو رقم الشيك هنا..."
                    rows={2}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1 cursor-pointer font-bold" disabled={addPaymentMutation.isPending}>
                    {addPaymentMutation.isPending ? "جاري التسجيل..." : "تسجيل الدفعة"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setPaymentDialogOpen(false)} className="cursor-pointer">
                    إلغاء
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Button onClick={handlePrintStatement} className="gap-2 cursor-pointer font-bold" variant="outline">
            <Printer className="h-4 w-4" />
            <span>طباعة كشف حساب تفصيلي</span>
          </Button>
        </div>
      </div>

      {/* Client Header Info Card */}
      <div className="flex items-start gap-4 flex-wrap bg-card p-6 rounded-xl border border-border/80">
        <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Building className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-foreground">{client.name}</h1>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-muted-foreground text-sm">
            {client.phone && (
              <div className="flex items-center gap-1 font-mono">
                <Phone className="h-4 w-4" />
                <span>{client.phone}</span>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-1">
                <Mail className="h-4 w-4" />
                <span>{client.email}</span>
              </div>
            )}
            {client.city && (
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span>{client.city} {client.address ? `- ${client.address}` : ""}</span>
              </div>
            )}
          </div>
          {client.notes && (
            <p className="text-xs text-muted-foreground bg-muted/40 p-2 rounded mt-2 border border-border/40">
              <span className="font-bold">ملاحظات:</span> {client.notes}
            </p>
          )}
        </div>
      </div>

      {/* Financial Statistics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              قيمة الأعمال والمطالبات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-foreground">
                {clientFinancials.totalBilled.toLocaleString()} د.ل
              </span>
              <Building className="h-5 w-5 text-primary" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              مجموع قيم البنود المنجزة والمصاريف والمشتريات
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              إجمالي المبالغ المسددة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-green-600 dark:text-green-400">
                {clientFinancials.totalPaid.toLocaleString()} د.ل
              </span>
              <Wallet className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              إجمالي الدفعات المقبوضة التي سددها العميل
            </p>
          </CardContent>
        </Card>

        <Card className={`border-border ${clientFinancials.remaining > 0 ? "bg-red-500/5 border-red-500/20" : "bg-green-500/5 border-green-500/20"}`}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-xs font-semibold uppercase ${clientFinancials.remaining > 0 ? "text-red-700" : "text-green-700"}`}>
              المتبقي بذمة العميل
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <span className={`text-2xl font-black ${clientFinancials.remaining > 0 ? "text-red-600" : "text-green-600"}`}>
                {clientFinancials.remaining.toLocaleString()} د.ل
              </span>
              <Coins className={`h-5 w-5 ${clientFinancials.remaining > 0 ? "text-red-500" : "text-green-500"}`} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {clientFinancials.remaining > 0 ? "مستحقات معلقة بانتظار التحصيل المالي" : "الحساب متوازن أو دفع بالزيادة"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Projects Table */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle>مشاريع العميل وقيمها</CardTitle>
          <Link to={`/projects/new?client_id=${client.id}`}>
            <Button size="sm" className="h-8 text-xs cursor-pointer">
              <Plus className="h-4 w-4 ml-1" />
              مشروع جديد
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {projects && projects.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">المشروع</TableHead>
                  <TableHead className="text-right">نوع المشروع</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-center">ميزانية المشروع</TableHead>
                  <TableHead className="text-center">قيمة الأعمال المنجزة</TableHead>
                  <TableHead className="text-left w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => {
                  const billAmount = clientFinancials.projectBills[project.id] || 0;
                  return (
                    <TableRow key={project.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="font-semibold">{project.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {project.project_type === "contracting" ? "مقاولات" : "تشطيبات"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[project.status] || ""}>
                          {statusLabels[project.status] || project.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {Number(project.budget) > 0 ? formatCurrencyLYD(project.budget) : "---"}
                      </TableCell>
                      <TableCell className="text-center font-bold text-foreground">
                        {billAmount.toLocaleString()} د.ل
                      </TableCell>
                      <TableCell className="text-left">
                        <Button variant="ghost" size="sm" asChild className="cursor-pointer">
                          <Link to={`/projects/${project.id}/phases`}>
                            <span>عرض التفاصيل</span>
                            <ArrowUpRight className="h-4 w-4 mr-1" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد مشاريع لهذا العميل</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client Payments (تسديدات الزبون) Table */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle>كشف الدفعات والتسديدات المستلمة</CardTitle>
          <Button
            size="sm"
            onClick={() => setPaymentDialogOpen(true)}
            className="h-8 text-xs cursor-pointer bg-green-600 hover:bg-green-700 text-white font-bold"
          >
            <Plus className="h-4 w-4 ml-1" />
            إضافة دفعة
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {payments && payments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right w-[60px]">ر.م</TableHead>
                  <TableHead className="text-right">تاريخ السداد</TableHead>
                  <TableHead className="text-center">قيمة الدفعة</TableHead>
                  <TableHead className="text-right">طريقة الدفع</TableHead>
                  <TableHead className="text-right">الخزينة / الحساب المستلم</TableHead>
                  <TableHead className="text-right">ملاحظات</TableHead>
                  <TableHead className="text-left w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment, idx) => (
                  <TableRow key={payment.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="text-muted-foreground text-right">{idx + 1}</TableCell>
                    <TableCell className="font-semibold flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{format(new Date(payment.date), "yyyy/MM/dd")}</span>
                    </TableCell>
                    <TableCell className="text-center font-bold text-green-600 dark:text-green-400">
                      {payment.amount.toLocaleString()} د.ل
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {methodLabels[payment.payment_method] || payment.payment_method}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">
                      {payment.treasuries?.name || "---"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {payment.notes || "---"}
                    </TableCell>
                    <TableCell className="text-left">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 cursor-pointer text-primary hover:text-primary/80"
                        onClick={() => handlePrintReceipt(payment)}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>لم يتم تسجيل أي دفعات أو تسديدات مستلمة من هذا العميل حتى الآن</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contracts Table */}
      {contracts && contracts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>عقود العميل</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">العقد</TableHead>
                  <TableHead className="text-right">رقم العقد</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-center">القيمة</TableHead>
                  <TableHead className="text-right">تاريخ البداية</TableHead>
                  <TableHead className="text-left w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => (
                  <TableRow key={contract.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="font-semibold">{contract.title}</TableCell>
                    <TableCell className="text-xs">{contract.contract_number}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[contract.status] || ""}>
                        {statusLabels[contract.status] || contract.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {formatCurrencyLYD(contract.amount)}
                    </TableCell>
                    <TableCell>{contract.start_date}</TableCell>
                    <TableCell className="text-left">
                      <Button variant="ghost" size="sm" asChild className="cursor-pointer">
                        <Link to={`/contracts/${contract.id}`}>
                          <span>عرض</span>
                          <ArrowUpRight className="h-4 w-4 mr-1" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
