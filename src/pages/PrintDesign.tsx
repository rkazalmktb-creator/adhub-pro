import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  Save, 
  Loader2, 
  RotateCcw, 
  ChevronRight, 
  ChevronLeft,
  Palette,
  Layout,
  Type,
  FileText,
  Table,
  AlignVerticalJustifyStart,
  Square,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Tags,
  ShoppingCart,
  Wallet,
  Truck,
  Users,
  ClipboardList,
  Layers,
  FileSignature,
  Building2,
  Upload,
  ClipboardPaste,
  Trash2,
  Phone,
  MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_PRINT_LABELS, getPrintLabels, PrintLabelsConfig } from "@/lib/printLabels";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CompanySettings {
  id: string;
  company_name: string;
  company_logo: string | null;
  company_phone?: string | null;
  company_address?: string | null;
  print_header_enabled?: boolean | null;
  report_background: string | null;
  report_bg_pos_x_mm?: number;
  report_bg_pos_y_mm?: number;
  report_bg_scale_percent?: number;
  report_padding_top_mm?: number;
  report_padding_right_mm?: number;
  report_padding_bottom_mm?: number;
  report_padding_left_mm?: number;
  report_content_max_height_mm?: number;
  report_footer_enabled?: boolean;
  report_footer_height_mm?: number;
  report_footer_bottom_mm?: number;
  print_table_header_color?: string;
  print_table_border_color?: string;
  print_section_title_color?: string;
  print_labels?: any;
  contract_logo_position?: string | null;
  contract_title_text?: string | null;
  contract_show_project_info?: boolean | null;
  contract_show_description?: boolean | null;
  contract_show_items_table?: boolean | null;
  contract_show_clauses?: boolean | null;
  contract_show_signatures?: boolean | null;
  contract_header_bg_color?: string | null;
  contract_header_text_color?: string | null;
  contract_accent_color?: string | null;
  contract_font_size_body?: number | null;
  contract_font_size_title?: number | null;
  contract_signature_labels?: any;
  header_show_logo?: boolean | null;
  header_show_name?: boolean | null;
  header_show_tagline?: boolean | null;
  company_tagline?: string | null;
  header_logo_height?: number | null;
  header_font_size_name?: number | null;
  header_font_size_tagline?: number | null;
  header_font_size_meta?: number | null;
  footer_icon_color?: string | null;
  footer_font_size?: number | null;
  header_height_mm?: number | null;
  header_flipped?: boolean | null;
  print_font_family?: string | null;
  custom_font_name?: string | null;
  custom_font_data?: string | null;
  print_zoom_percent?: number | null;
  print_totals_bg_color?: string | null;
  print_totals_text_color?: string | null;
}

const DEFAULT_PRINT_TEMPLATE = {
  bgPosX: 0,
  bgPosY: 0,
  bgScale: 100,
  padTop: 55,
  padRight: 12,
  padBottom: 35,
  padLeft: 12,
  contentMaxH: 200,
  footerEnabled: true,
  footerHeight: 15,
  footerBottom: 10,
  tableHeaderColor: '#B4A078',
  tableBorderColor: '#888888',
  sectionTitleColor: '#7A5A10',
  tableRowEvenColor: '#f9f9f9',
  tableRowOddColor: '#ffffff',
  tableTextColor: '#333333',
  headerTextColor: '#ffffff',
  tableFontSize: 11,
  headerFontSize: 12,
  titleFontSize: 14,
  borderWidth: 1,
  borderRadius: 0,
  cellPadding: 6,
  printZoomPercent: 100,
  totalsBgColor: '#B4A078',
  totalsTextColor: '#ffffff',
} as const;

// Label input component
const LabelInput = ({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) => (
  <div className="space-y-1">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 text-sm"
      dir="rtl"
    />
  </div>
);

// Color input component
const ColorInput = ({ label, value, onChange, description }: { 
  label: string; 
  value: string; 
  onChange: (v: string) => void;
  description?: string;
}) => (
  <div className="space-y-2">
    <Label className="text-sm">{label}</Label>
    <div className="flex gap-2 items-center">
      <Input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-12 h-9 p-1 cursor-pointer border-2"
      />
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 font-mono text-sm"
        dir="ltr"
      />
    </div>
    {description && <p className="text-xs text-muted-foreground">{description}</p>}
  </div>
);

// Slider input component with local state to make dragging silky smooth
const SliderInput = ({ label, value, onChange, min, max, step = 1, unit = "" }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Label className="text-sm font-semibold">{label}</Label>
        <span className="text-sm font-mono text-muted-foreground">{localValue}{unit}</span>
      </div>
      <Slider
        value={[localValue]}
        onValueChange={([v]) => setLocalValue(v)}
        onValueCommit={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        className="w-full cursor-ew-resize"
      />
    </div>
  );
};

const PrintDesign = () => {
  const queryClient = useQueryClient();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.5);

  // Background controls
  const [bgPosX, setBgPosX] = useState<number>(DEFAULT_PRINT_TEMPLATE.bgPosX);
  const [bgPosY, setBgPosY] = useState<number>(DEFAULT_PRINT_TEMPLATE.bgPosY);
  const [bgScale, setBgScale] = useState<number>(DEFAULT_PRINT_TEMPLATE.bgScale);
  
  // Padding controls
  const [padTop, setPadTop] = useState<number>(DEFAULT_PRINT_TEMPLATE.padTop);
  const [padRight, setPadRight] = useState<number>(DEFAULT_PRINT_TEMPLATE.padRight);
  const [padBottom, setPadBottom] = useState<number>(DEFAULT_PRINT_TEMPLATE.padBottom);
  const [padLeft, setPadLeft] = useState<number>(DEFAULT_PRINT_TEMPLATE.padLeft);
  const [contentMaxH, setContentMaxH] = useState<number>(DEFAULT_PRINT_TEMPLATE.contentMaxH);

  const [footerEnabled, setFooterEnabled] = useState<boolean>(DEFAULT_PRINT_TEMPLATE.footerEnabled);
  const [footerHeight, setFooterHeight] = useState<number>(DEFAULT_PRINT_TEMPLATE.footerHeight);
  const [footerBottom, setFooterBottom] = useState<number>(DEFAULT_PRINT_TEMPLATE.footerBottom);
  const [printDatePosition, setPrintDatePosition] = useState<string>("bottom_left");

  // Table color controls
  const [tableHeaderColor, setTableHeaderColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.tableHeaderColor);
  const [tableBorderColor, setTableBorderColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.tableBorderColor);
  const [sectionTitleColor, setSectionTitleColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.sectionTitleColor);
  
  // Extended table controls (local only for now - for preview)
  const [tableRowEvenColor, setTableRowEvenColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.tableRowEvenColor);
  const [tableRowOddColor, setTableRowOddColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.tableRowOddColor);
  const [tableTextColor, setTableTextColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.tableTextColor);
  const [headerTextColor, setHeaderTextColor] = useState<string>(DEFAULT_PRINT_TEMPLATE.headerTextColor);
  const [tableFontSize, setTableFontSize] = useState<number>(DEFAULT_PRINT_TEMPLATE.tableFontSize);
  const [headerFontSize, setHeaderFontSize] = useState<number>(DEFAULT_PRINT_TEMPLATE.headerFontSize);
  const [titleFontSize, setTitleFontSize] = useState<number>(DEFAULT_PRINT_TEMPLATE.titleFontSize);
  const [borderWidth, setBorderWidth] = useState<number>(DEFAULT_PRINT_TEMPLATE.borderWidth);
  const [borderRadius, setBorderRadius] = useState<number>(DEFAULT_PRINT_TEMPLATE.borderRadius);
  const [cellPadding, setCellPadding] = useState<number>(DEFAULT_PRINT_TEMPLATE.cellPadding);

  // Print labels state
  const [printLabels, setPrintLabels] = useState<PrintLabelsConfig>(JSON.parse(JSON.stringify(DEFAULT_PRINT_LABELS)));
  const [activeElementTab, setActiveElementTab] = useState<string>("purchases");
  const [activeLeftTab, setActiveLeftTab] = useState<string>("company");

  // Company details
  const [companyName, setCompanyName] = useState("");
  const [companyLogo, setCompanyLogo] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [printHeaderEnabled, setPrintHeaderEnabled] = useState<boolean>(false);
  const [reportBackground, setReportBackground] = useState("");

  // Contract print settings
  const [contractLogoPosition, setContractLogoPosition] = useState("right");
  const [contractTitleText, setContractTitleText] = useState("عـقـد مـقـاولـة");
  const [contractShowProjectInfo, setContractShowProjectInfo] = useState(true);
  const [contractShowDescription, setContractShowDescription] = useState(true);
  const [contractShowItemsTable, setContractShowItemsTable] = useState(true);
  const [contractShowClauses, setContractShowClauses] = useState(true);
  const [contractShowSignatures, setContractShowSignatures] = useState(true);
  const [contractHeaderBg, setContractHeaderBg] = useState("#1a365d");
  const [contractHeaderText, setContractHeaderText] = useState("#ffffff");
  const [contractAccent, setContractAccent] = useState("#c6973f");
  const [contractFontSizeBody, setContractFontSizeBody] = useState(11);
  const [contractFontSizeTitle, setContractFontSizeTitle] = useState(18);
  const [contractSigLabel1, setContractSigLabel1] = useState("الطرف الأول (صاحب العمل)");
  const [contractSigLabel2, setContractSigLabel2] = useState("الطرف الثاني (المقاول)");

  // Unified Header/Footer Customization States
  const [headerShowLogo, setHeaderShowLogo] = useState(true);
  const [headerShowName, setHeaderShowName] = useState(true);
  const [headerShowTagline, setHeaderShowTagline] = useState(true);
  const [companyTagline, setCompanyTagline] = useState("شركة مقاولات وتجهيزات");
  const [headerLogoHeight, setHeaderLogoHeight] = useState(50);
  const [headerFontSizeName, setHeaderFontSizeName] = useState(14);
  const [headerFontSizeTagline, setHeaderFontSizeTagline] = useState(10);
  const [headerFontSizeMeta, setHeaderFontSizeMeta] = useState(10);
  const [footerIconColor, setFooterIconColor] = useState("#B4A078");
  const [footerFontSize, setFooterFontSize] = useState(9);
  const [headerHeightMm, setHeaderHeightMm] = useState(25);
  const [headerFlipped, setHeaderFlipped] = useState(false);
  const [printFontFamily, setPrintFontFamily] = useState("Tajawal");
  const [customFontName, setCustomFontName] = useState("");
  const [customFontData, setCustomFontData] = useState("");
  const [printZoomPercent, setPrintZoomPercent] = useState(100);
  const [totalsBgColor, setTotalsBgColor] = useState("#B4A078");
  const [totalsTextColor, setTotalsTextColor] = useState("#ffffff");

  // Image Upload & Paste Handlers
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1.5 * 1024 * 1024) {
        toast.error("حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 1.5 ميجابايت");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setCompanyLogo(event.target?.result as string);
        toast.success("تم رفع الشعار بنجاح");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("حجم ملف الخط كبير جداً، يرجى اختيار ملف أقل من 2 ميجابايت");
        return;
      }
      // Sanitize font name to prevent CSS syntax errors
      const fontName = file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '');
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setCustomFontName(fontName);
        setCustomFontData(dataUrl);
        setPrintFontFamily(fontName); // Automatically select custom uploaded font
        toast.success(`تم رفع الخط "${fontName}" وتطبيقه بنجاح`);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePasteLogo = async () => {
    if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
      toast.error("لصق الصور برمجياً غير مدعوم في هذا الاتصال. يرجى تشغيل النظام على HTTPS أو localhost، أو رفع الصورة يدوياً.");
      return;
    }
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            const reader = new FileReader();
            reader.onload = (event) => {
              setCompanyLogo(event.target?.result as string);
              toast.success("تم لصق الشعار من الحافظة");
            };
            reader.readAsDataURL(blob);
            return;
          }
        }
      }
      toast.error("لم يتم العثور على صورة في الحافظة. يرجى نسخ صورة أولاً.");
    } catch (err) {
      toast.error("فشل قراءة الحافظة. يرجى التأكد من السماح بالوصول.");
    }
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2.5 * 1024 * 1024) {
        toast.error("حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 2.5 ميجابايت");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setReportBackground(event.target?.result as string);
        toast.success("تم رفع الخلفية بنجاح");
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePasteBg = async () => {
    if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
      toast.error("لصق الصور برمجياً غير مدعوم في هذا الاتصال. يرجى تشغيل النظام على HTTPS أو localhost، أو رفع الصورة يدوياً.");
      return;
    }
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            const reader = new FileReader();
            reader.onload = (event) => {
              setReportBackground(event.target?.result as string);
              toast.success("تم لصق الخلفية من الحافظة");
            };
            reader.readAsDataURL(blob);
            return;
          }
        }
      }
      toast.error("لم يتم العثور على صورة في الحافظة. يرجى نسخ صورة أولاً.");
    } catch (err) {
      toast.error("فشل قراءة الحافظة. يرجى التأكد من السماح بالوصول.");
    }
  };

  // Fetch settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .limit(1)
        .single();
      
      if (error) throw error;
      return data as CompanySettings & {
        print_table_row_even_color?: string;
        print_table_row_odd_color?: string;
        print_table_text_color?: string;
        print_header_text_color?: string;
        print_table_font_size?: number;
        print_header_font_size?: number;
        print_title_font_size?: number;
        print_border_width?: number;
        print_border_radius?: number;
        print_cell_padding?: number;
      };
    },
  });

  // Set initial values when data loads
  useEffect(() => {
    if (settings) {
      setBgPosX(Number(settings.report_bg_pos_x_mm ?? DEFAULT_PRINT_TEMPLATE.bgPosX));
      setBgPosY(Number(settings.report_bg_pos_y_mm ?? DEFAULT_PRINT_TEMPLATE.bgPosY));
      setBgScale(Number(settings.report_bg_scale_percent ?? DEFAULT_PRINT_TEMPLATE.bgScale));
      setPadTop(Number(settings.report_padding_top_mm ?? DEFAULT_PRINT_TEMPLATE.padTop));
      setPadRight(Number(settings.report_padding_right_mm ?? DEFAULT_PRINT_TEMPLATE.padRight));
      setPadBottom(Number(settings.report_padding_bottom_mm ?? DEFAULT_PRINT_TEMPLATE.padBottom));
      setPadLeft(Number(settings.report_padding_left_mm ?? DEFAULT_PRINT_TEMPLATE.padLeft));
      setContentMaxH(Number(settings.report_content_max_height_mm ?? DEFAULT_PRINT_TEMPLATE.contentMaxH));

      setFooterEnabled(settings.report_footer_enabled ?? DEFAULT_PRINT_TEMPLATE.footerEnabled);
      setFooterHeight(Number(settings.report_footer_height_mm ?? DEFAULT_PRINT_TEMPLATE.footerHeight));
      setFooterBottom(Number(settings.report_footer_bottom_mm ?? DEFAULT_PRINT_TEMPLATE.footerBottom));
      setPrintDatePosition((settings as any).print_date_position ?? "bottom_left");

      setTableHeaderColor(settings.print_table_header_color ?? DEFAULT_PRINT_TEMPLATE.tableHeaderColor);
      setTableBorderColor(settings.print_table_border_color ?? DEFAULT_PRINT_TEMPLATE.tableBorderColor);
      setSectionTitleColor(settings.print_section_title_color ?? DEFAULT_PRINT_TEMPLATE.sectionTitleColor);
      
      // Extended settings
      setTableRowEvenColor(settings.print_table_row_even_color ?? DEFAULT_PRINT_TEMPLATE.tableRowEvenColor);
      setTableRowOddColor(settings.print_table_row_odd_color ?? DEFAULT_PRINT_TEMPLATE.tableRowOddColor);
      setTableTextColor(settings.print_table_text_color ?? DEFAULT_PRINT_TEMPLATE.tableTextColor);
      setHeaderTextColor(settings.print_header_text_color ?? DEFAULT_PRINT_TEMPLATE.headerTextColor);
      setTableFontSize(Number(settings.print_table_font_size ?? DEFAULT_PRINT_TEMPLATE.tableFontSize));
      setHeaderFontSize(Number(settings.print_header_font_size ?? DEFAULT_PRINT_TEMPLATE.headerFontSize));
      setTitleFontSize(Number(settings.print_title_font_size ?? DEFAULT_PRINT_TEMPLATE.titleFontSize));
      setBorderWidth(Number(settings.print_border_width ?? DEFAULT_PRINT_TEMPLATE.borderWidth));
      setBorderRadius(Number(settings.print_border_radius ?? DEFAULT_PRINT_TEMPLATE.borderRadius));
      setCellPadding(Number(settings.print_cell_padding ?? DEFAULT_PRINT_TEMPLATE.cellPadding));
      
      // Company details
      setCompanyName(settings.company_name || "");
      setCompanyLogo(settings.company_logo || "");
      setCompanyPhone(settings.company_phone || "");
      setCompanyAddress(settings.company_address || "");
      setPrintHeaderEnabled(settings.print_header_enabled ?? false);
      setReportBackground(settings.report_background || "");

      // Unified Header/Footer Customization
      setHeaderShowLogo(settings.header_show_logo !== false);
      setHeaderShowName(settings.header_show_name !== false);
      setHeaderShowTagline(settings.header_show_tagline !== false);
      setCompanyTagline(settings.company_tagline || "شركة مقاولات وتجهيزات");
      setHeaderLogoHeight(Number(settings.header_logo_height ?? 50));
      setHeaderFontSizeName(Number(settings.header_font_size_name ?? 14));
      setHeaderFontSizeTagline(Number(settings.header_font_size_tagline ?? 10));
      setHeaderFontSizeMeta(Number(settings.header_font_size_meta ?? 10));
      setFooterIconColor(settings.footer_icon_color || "#B4A078");
      setFooterFontSize(Number(settings.footer_font_size ?? 9));
      setHeaderHeightMm(Number(settings.header_height_mm ?? 25));
      setHeaderFlipped(settings.header_flipped ?? false);
      setPrintFontFamily(settings.print_font_family || "Tajawal");
      setCustomFontName(settings.custom_font_name || "");
      setCustomFontData(settings.custom_font_data || "");
      setPrintZoomPercent(Number(settings.print_zoom_percent ?? 100));
      setTotalsBgColor(settings.print_totals_bg_color || DEFAULT_PRINT_TEMPLATE.totalsBgColor);
      setTotalsTextColor(settings.print_totals_text_color || DEFAULT_PRINT_TEMPLATE.totalsTextColor);

      // Contract print settings
      setContractLogoPosition(settings.contract_logo_position || "right");
      setContractTitleText(settings.contract_title_text || "عـقـد مـقـاولـة");
      setContractShowProjectInfo(settings.contract_show_project_info !== false);
      setContractShowDescription(settings.contract_show_description !== false);
      setContractShowItemsTable(settings.contract_show_items_table !== false);
      setContractShowClauses(settings.contract_show_clauses !== false);
      setContractShowSignatures(settings.contract_show_signatures !== false);
      setContractHeaderBg(settings.contract_header_bg_color || "#1a365d");
      setContractHeaderText(settings.contract_header_text_color || "#ffffff");
      setContractAccent(settings.contract_accent_color || "#c6973f");
      setContractFontSizeBody(Number(settings.contract_font_size_body || 11));
      setContractFontSizeTitle(Number(settings.contract_font_size_title || 18));
      const sigLabels = Array.isArray(settings.contract_signature_labels) ? settings.contract_signature_labels : ["الطرف الأول (صاحب العمل)", "الطرف الثاني (المقاول)"];
      setContractSigLabel1(sigLabels[0] || "الطرف الأول (صاحب العمل)");
      setContractSigLabel2(sigLabels[1] || "الطرف الثاني (المقاول)");

      // Print labels
      setPrintLabels(getPrintLabels(settings.print_labels));
    }
  }, [settings]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!settings?.id) throw new Error("No settings found");
      
      const { error } = await supabase
        .from("company_settings")
        .update({
          company_name: companyName,
          company_logo: companyLogo || null,
          company_phone: companyPhone || null,
          company_address: companyAddress || null,
          print_header_enabled: printHeaderEnabled,
          report_background: reportBackground || null,
          header_show_logo: headerShowLogo,
          header_show_name: headerShowName,
          header_show_tagline: headerShowTagline,
          company_tagline: companyTagline,
          header_logo_height: headerLogoHeight,
          header_font_size_name: headerFontSizeName,
          header_font_size_tagline: headerFontSizeTagline,
          header_font_size_meta: headerFontSizeMeta,
          footer_icon_color: footerIconColor,
          footer_font_size: footerFontSize,
          header_height_mm: headerHeightMm,
          header_flipped: headerFlipped,
          print_font_family: printFontFamily,
          custom_font_name: customFontName || null,
          custom_font_data: customFontData || null,
          print_zoom_percent: printZoomPercent,
          print_totals_bg_color: totalsBgColor,
          print_totals_text_color: totalsTextColor,
          report_bg_pos_x_mm: bgPosX,
          report_bg_pos_y_mm: bgPosY,
          report_bg_scale_percent: bgScale,
          report_padding_top_mm: padTop,
          report_padding_right_mm: padRight,
          report_padding_bottom_mm: padBottom,
          report_padding_left_mm: padLeft,
          report_content_max_height_mm: contentMaxH,
          report_footer_enabled: footerEnabled,
          report_footer_height_mm: footerHeight,
          report_footer_bottom_mm: footerBottom,
          print_date_position: printDatePosition,
          print_table_header_color: tableHeaderColor,
          print_table_border_color: tableBorderColor,
          print_section_title_color: sectionTitleColor,
          // Extended settings
          print_table_row_even_color: tableRowEvenColor,
          print_table_row_odd_color: tableRowOddColor,
          print_table_text_color: tableTextColor,
          print_header_text_color: headerTextColor,
          print_table_font_size: tableFontSize,
          print_header_font_size: headerFontSize,
          print_title_font_size: titleFontSize,
          print_border_width: borderWidth,
          print_border_radius: borderRadius,
          print_cell_padding: cellPadding,
          print_labels: printLabels as any,
          // Contract settings
          contract_logo_position: contractLogoPosition,
          contract_title_text: contractTitleText,
          contract_show_project_info: contractShowProjectInfo,
          contract_show_description: contractShowDescription,
          contract_show_items_table: contractShowItemsTable,
          contract_show_clauses: contractShowClauses,
          contract_show_signatures: contractShowSignatures,
          contract_header_bg_color: contractHeaderBg,
          contract_header_text_color: contractHeaderText,
          contract_accent_color: contractAccent,
          contract_font_size_body: contractFontSizeBody,
          contract_font_size_title: contractFontSizeTitle,
          contract_signature_labels: [contractSigLabel1, contractSigLabel2],
        } as any)
        .eq("id", settings.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      toast.success("تم حفظ إعدادات التصميم بنجاح");
    },
    onError: (error) => {
      toast.error("حدث خطأ أثناء حفظ الإعدادات");
      console.error(error);
    },
  });

  const handleReset = () => {
    setBgPosX(DEFAULT_PRINT_TEMPLATE.bgPosX);
    setBgPosY(DEFAULT_PRINT_TEMPLATE.bgPosY);
    setBgScale(DEFAULT_PRINT_TEMPLATE.bgScale);
    setPadTop(DEFAULT_PRINT_TEMPLATE.padTop);
    setPadRight(DEFAULT_PRINT_TEMPLATE.padRight);
    setPadBottom(DEFAULT_PRINT_TEMPLATE.padBottom);
    setPadLeft(DEFAULT_PRINT_TEMPLATE.padLeft);
    setContentMaxH(DEFAULT_PRINT_TEMPLATE.contentMaxH);
    setTableHeaderColor(DEFAULT_PRINT_TEMPLATE.tableHeaderColor);
    setTableBorderColor(DEFAULT_PRINT_TEMPLATE.tableBorderColor);
    setSectionTitleColor(DEFAULT_PRINT_TEMPLATE.sectionTitleColor);
    setTableRowEvenColor(DEFAULT_PRINT_TEMPLATE.tableRowEvenColor);
    setTableRowOddColor(DEFAULT_PRINT_TEMPLATE.tableRowOddColor);
    setTableTextColor(DEFAULT_PRINT_TEMPLATE.tableTextColor);
    setHeaderTextColor(DEFAULT_PRINT_TEMPLATE.headerTextColor);
    setTableFontSize(DEFAULT_PRINT_TEMPLATE.tableFontSize);
    setHeaderFontSize(DEFAULT_PRINT_TEMPLATE.headerFontSize);
    setTitleFontSize(DEFAULT_PRINT_TEMPLATE.titleFontSize);
    setBorderWidth(DEFAULT_PRINT_TEMPLATE.borderWidth);
    setBorderRadius(DEFAULT_PRINT_TEMPLATE.borderRadius);
    setCellPadding(DEFAULT_PRINT_TEMPLATE.cellPadding);
    setFooterEnabled(DEFAULT_PRINT_TEMPLATE.footerEnabled);
    setFooterHeight(DEFAULT_PRINT_TEMPLATE.footerHeight);
    setFooterBottom(DEFAULT_PRINT_TEMPLATE.footerBottom);
    setPrintDatePosition("bottom_left");
    setPrintLabels(JSON.parse(JSON.stringify(DEFAULT_PRINT_LABELS)));
    toast.info("تم إعادة الضبط للقيم الافتراضية");
  };

  // Helper to update a label field
  const updateLabel = <K extends keyof PrintLabelsConfig>(
    section: K,
    field: string,
    value: any
  ) => {
    setPrintLabels(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };



  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Sample data for preview
  const sampleTableData = [
    { name: "أعمال البلاط", quantity: "150", unit: "م²", price: "45.00", total: "6,750.00" },
    { name: "أعمال الدهان", quantity: "200", unit: "م²", price: "25.00", total: "5,000.00" },
    { name: "تمديدات كهربائية", quantity: "80", unit: "م.ط", price: "35.00", total: "2,800.00" },
  ];

  return (
    <div className="h-[calc(100vh-120px)] flex gap-4">
      {/* Controls Sidebar */}
      <div 
        className={cn(
          "transition-all duration-300 flex flex-col bg-card rounded-lg border overflow-hidden",
          sidebarCollapsed ? "w-12" : "w-[380px]"
        )}
      >
        {/* Sidebar Header */}
        <div className="p-3 border-b flex items-center justify-between bg-muted/30">
          {!sidebarCollapsed && (
            <h2 className="font-bold text-lg">إعدادات التصميم</h2>
          )}
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="shrink-0"
          >
            {sidebarCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        {/* Sidebar Content */}
        {!sidebarCollapsed && (
          <ScrollArea className="flex-1">
            <div className="p-4">
              <Tabs value={activeLeftTab} onValueChange={setActiveLeftTab} className="w-full">
                <TabsList className="w-full grid grid-cols-7 mb-4">
                  <TabsTrigger value="company" className="text-xs px-1" title="معلومات الشركة">
                    <Building2 className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="colors" className="text-xs px-1" title="الألوان">
                    <Palette className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="table" className="text-xs px-1" title="الجدول">
                    <Table className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="layout" className="text-xs px-1" title="التخطيط">
                    <Layout className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="footer" className="text-xs px-1" title="التذييل">
                    <AlignVerticalJustifyStart className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="contracts_config" className="text-xs px-1" title="طباعة العقود">
                    <FileSignature className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="elements" className="text-xs px-1" title="تسميات الطباعة">
                    <Tags className="h-4 w-4" />
                  </TabsTrigger>
                </TabsList>

                {/* Company Info Tab */}
                <TabsContent value="company" className="space-y-6 mt-0">
                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" />
                        معلومات الشركة والشعار
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="companyName">اسم الشركة</Label>
                        <Input
                          id="companyName"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="أدخل اسم الشركة"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="companyPhone">رقم هاتف الشركة</Label>
                        <Input
                          id="companyPhone"
                          value={companyPhone}
                          onChange={(e) => setCompanyPhone(e.target.value)}
                          placeholder="أدخل رقم هاتف الشركة"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="companyAddress">عنوان الشركة</Label>
                        <Input
                          id="companyAddress"
                          value={companyAddress}
                          onChange={(e) => setCompanyAddress(e.target.value)}
                          placeholder="أدخل عنوان الشركة"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="companyLogo">شعار الشركة (رابط أو رفع/لصق)</Label>
                        <div className="flex gap-2">
                          <Input
                            id="companyLogo"
                            value={companyLogo}
                            onChange={(e) => setCompanyLogo(e.target.value)}
                            placeholder="رابط الشعار أو البيانات (base64)"
                            className="flex-1 text-xs"
                            dir="ltr"
                          />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="hidden"
                            id="logo-upload-input"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            title="رفع صورة"
                            onClick={() => document.getElementById("logo-upload-input")?.click()}
                            className="shrink-0 cursor-pointer"
                          >
                            <Upload className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            title="لصق من الحافظة"
                            onClick={handlePasteLogo}
                            className="shrink-0 cursor-pointer"
                          >
                            <ClipboardPaste className="h-4 w-4" />
                          </Button>
                          {companyLogo && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              title="حذف"
                              onClick={() => setCompanyLogo("")}
                              className="shrink-0 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {companyLogo && (
                          <div className="border rounded-lg p-2 bg-muted/20 flex justify-center items-center h-16 mt-1">
                            <img
                              src={companyLogo}
                              alt="شعار الشركة"
                              className="max-h-12 object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://placehold.co/100x50?text=Error';
                              }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/40 mt-4">
                        <div className="space-y-0.5 max-w-[80%]">
                          <Label htmlFor="printHeaderEnabled" className="text-sm font-semibold cursor-pointer">تفعيل الهيدر والفوتر النصي الموحد</Label>
                          <p className="text-[10px] text-muted-foreground leading-tight">
                            يلغي صورة الخلفية ويستبدلها بهيدر وفوتر نصي موحدين في أعلى وأسفل كل صفحة مطبوعة.
                          </p>
                        </div>
                        <Switch
                          id="printHeaderEnabled"
                          checked={printHeaderEnabled}
                          onCheckedChange={setPrintHeaderEnabled}
                          className="cursor-pointer"
                        />
                      </div>

                      {printHeaderEnabled && (
                        <div className="space-y-4 pt-4 border-t border-border mt-4">
                          <p className="text-xs font-bold text-primary">تخصيص عناصر الهيدر والفوتر</p>

                          {/* Visibility Controls */}
                          <div className="space-y-2 bg-muted/30 p-3 rounded-lg border border-border">
                            <Label className="text-xs font-semibold">إظهار وإخفاء العناصر</Label>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="flex items-center gap-2 cursor-pointer py-0.5">
                                <input
                                  type="checkbox"
                                  checked={headerShowLogo}
                                  onChange={(e) => setHeaderShowLogo(e.target.checked)}
                                  className="w-3.5 h-3.5 rounded border-gray-300 text-primary"
                                />
                                <span className="text-xs select-none">إظهار الشعار</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer py-0.5">
                                <input
                                  type="checkbox"
                                  checked={headerShowName}
                                  onChange={(e) => setHeaderShowName(e.target.checked)}
                                  className="w-3.5 h-3.5 rounded border-gray-300 text-primary"
                                />
                                <span className="text-xs select-none">إظهار اسم الشركة</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer py-0.5 col-span-2">
                                <input
                                  type="checkbox"
                                  checked={headerShowTagline}
                                  onChange={(e) => setHeaderShowTagline(e.target.checked)}
                                  className="w-3.5 h-3.5 rounded border-gray-300 text-primary"
                                />
                                <span className="text-xs select-none">إظهار نشاط/وصف الشركة</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer py-0.5 col-span-2 border-t pt-1.5 mt-1 border-border/50">
                                <input
                                  type="checkbox"
                                  checked={headerFlipped}
                                  onChange={(e) => setHeaderFlipped(e.target.checked)}
                                  className="w-3.5 h-3.5 rounded border-gray-300 text-primary"
                                />
                                <span className="text-xs select-none font-medium text-amber-600">قلب اتجاه الهيدر (الشعار لليسار والبيانات لليمين)</span>
                              </label>
                            </div>
                          </div>

                          {/* Tagline Edit */}
                          {headerShowTagline && (
                            <div className="space-y-1">
                              <Label className="text-xs">وصف/نشاط الشركة في الهيدر</Label>
                              <Input
                                value={companyTagline}
                                onChange={(e) => setCompanyTagline(e.target.value)}
                                placeholder="مثال: شركة مقاولات وتجهيزات"
                                className="h-9 text-xs"
                              />
                            </div>
                          )}

                          {/* Size Controls */}
                          <div className="space-y-3 bg-muted/20 p-3 rounded-lg border border-border">
                            <Label className="text-xs font-semibold">أحجام العناصر والتخطيط</Label>
                            
                            {headerShowLogo && (
                              <SliderInput
                                label="ارتفاع الشعار"
                                value={headerLogoHeight}
                                onChange={setHeaderLogoHeight}
                                min={20}
                                max={100}
                                unit="px"
                              />
                            )}

                            {headerShowName && (
                              <SliderInput
                                label="حجم خط اسم الشركة"
                                value={headerFontSizeName}
                                onChange={setHeaderFontSizeName}
                                min={10}
                                max={24}
                                unit="px"
                              />
                            )}

                            {headerShowTagline && (
                              <SliderInput
                                label="حجم خط وصف الشركة"
                                value={headerFontSizeTagline}
                                onChange={setHeaderFontSizeTagline}
                                min={8}
                                max={16}
                                unit="px"
                              />
                            )}

                            <SliderInput
                              label="حجم خط البيانات الجانبية"
                              value={headerFontSizeMeta}
                              onChange={setHeaderFontSizeMeta}
                              min={8}
                              max={16}
                              unit="px"
                            />

                            <SliderInput
                              label="ارتفاع الهيدر الإجمالي"
                              value={headerHeightMm}
                              onChange={setHeaderHeightMm}
                              min={15}
                              max={60}
                              unit="mm"
                            />
                          </div>

                          {/* Footer Customization */}
                          <div className="space-y-3 bg-muted/20 p-3 rounded-lg border border-border">
                            <Label className="text-xs font-semibold">تنسيق الفوتر الموحد</Label>

                            <ColorInput
                              label="لون الأيقونات (الهاتف والموقع)"
                              value={footerIconColor}
                              onChange={setFooterIconColor}
                            />

                            <SliderInput
                              label="حجم خط الفوتر"
                              value={footerFontSize}
                              onChange={setFooterFontSize}
                              min={6}
                              max={14}
                              unit="px"
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Colors Tab */}
                <TabsContent value="colors" className="space-y-6 mt-0">
                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Palette className="h-4 w-4" />
                        ألوان الجدول
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ColorInput 
                        label="لون رأس الجدول" 
                        value={tableHeaderColor} 
                        onChange={setTableHeaderColor}
                      />
                      <ColorInput 
                        label="لون نص الرأس" 
                        value={headerTextColor} 
                        onChange={setHeaderTextColor}
                      />
                      <ColorInput 
                        label="لون الحدود" 
                        value={tableBorderColor} 
                        onChange={setTableBorderColor}
                      />
                      <ColorInput 
                        label="لون الصفوف الزوجية" 
                        value={tableRowEvenColor} 
                        onChange={setTableRowEvenColor}
                      />
                      <ColorInput 
                        label="لون الصفوف الفردية" 
                        value={tableRowOddColor} 
                        onChange={setTableRowOddColor}
                      />
                      <ColorInput 
                        label="لون النص" 
                        value={tableTextColor} 
                        onChange={setTableTextColor}
                      />
                    </CardContent>
                  </Card>

                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Type className="h-4 w-4" />
                        ألوان العناوين
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ColorInput 
                        label="لون عناوين الأقسام" 
                        value={sectionTitleColor} 
                        onChange={setSectionTitleColor}
                      />
                    </CardContent>
                  </Card>

                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Palette className="h-4 w-4" />
                        ألوان الإجمالي والمجاميع (Totals)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ColorInput 
                        label="لون خلفية صف الإجمالي" 
                        value={totalsBgColor} 
                        onChange={setTotalsBgColor}
                      />
                      <ColorInput 
                        label="لون نص صف الإجمالي" 
                        value={totalsTextColor} 
                        onChange={setTotalsTextColor}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Table Tab */}
                <TabsContent value="table" className="space-y-6 mt-0">
                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Type className="h-4 w-4" />
                        أحجام الخطوط
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <SliderInput 
                        label="حجم خط العنوان" 
                        value={titleFontSize} 
                        onChange={setTitleFontSize}
                        min={10}
                        max={20}
                        unit="px"
                      />
                      <SliderInput 
                        label="حجم خط الرأس" 
                        value={headerFontSize} 
                        onChange={setHeaderFontSize}
                        min={8}
                        max={16}
                        unit="px"
                      />
                      <SliderInput 
                        label="حجم خط الجدول" 
                        value={tableFontSize} 
                        onChange={setTableFontSize}
                        min={8}
                        max={14}
                        unit="px"
                      />
                    </CardContent>
                  </Card>

                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Square className="h-4 w-4" />
                        شكل الجدول
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <SliderInput 
                        label="سمك الحدود" 
                        value={borderWidth} 
                        onChange={setBorderWidth}
                        min={0}
                        max={3}
                        step={0.1}
                        unit="px"
                      />
                      <SliderInput 
                        label="استدارة الزوايا" 
                        value={borderRadius} 
                        onChange={setBorderRadius}
                        min={0}
                        max={10}
                        unit="px"
                      />
                      <SliderInput 
                        label="المسافة الداخلية للخلايا" 
                        value={cellPadding} 
                        onChange={setCellPadding}
                        min={2}
                        max={12}
                        unit="px"
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Layout Tab */}
                <TabsContent value="layout" className="space-y-6 mt-0">
                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        الخلفية
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="reportBackground">صورة الخلفية (رابط أو رفع/لصق)</Label>
                        <div className="flex gap-2">
                          <Input
                            id="reportBackground"
                            value={reportBackground}
                            onChange={(e) => setReportBackground(e.target.value)}
                            placeholder="مثال: /images/report-bg.png أو رابط كامل"
                            className="flex-1 text-xs"
                            dir="ltr"
                          />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleBgUpload}
                            className="hidden"
                            id="bg-upload-input"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            title="رفع خلفية"
                            onClick={() => document.getElementById("bg-upload-input")?.click()}
                            className="shrink-0 cursor-pointer"
                          >
                            <Upload className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            title="لصق من الحافظة"
                            onClick={handlePasteBg}
                            className="shrink-0 cursor-pointer"
                          >
                            <ClipboardPaste className="h-4 w-4" />
                          </Button>
                          {reportBackground && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              title="حذف"
                              onClick={() => setReportBackground("")}
                              className="shrink-0 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {reportBackground && (
                          <div className="border rounded-lg p-2 bg-muted/20 flex justify-center items-center h-20 mt-1">
                            <img
                              src={reportBackground}
                              alt="معاينة الخلفية"
                              className="max-h-16 object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://placehold.co/150x80?text=Error';
                              }}
                            />
                          </div>
                        )}
                      </div>

                      <div className="w-full h-px bg-border my-2" />

                      <SliderInput 
                        label="إزاحة X" 
                        value={bgPosX} 
                        onChange={setBgPosX}
                        min={-50}
                        max={50}
                        unit="mm"
                      />
                      <SliderInput 
                        label="إزاحة Y" 
                        value={bgPosY} 
                        onChange={setBgPosY}
                        min={-50}
                        max={50}
                        unit="mm"
                      />
                      <SliderInput 
                        label="الحجم" 
                        value={bgScale} 
                        onChange={setBgScale}
                        min={50}
                        max={150}
                        unit="%"
                      />
                    </CardContent>
                  </Card>

                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Type className="h-4 w-4" />
                        خط الطباعة والتقارير
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>نوع الخط الأساسي</Label>
                        <Select 
                          value={printFontFamily} 
                          onValueChange={(val) => {
                            if (val === "custom") {
                              // If they choose custom but none uploaded yet, open file picker
                              document.getElementById("font-upload-input")?.click();
                            } else {
                              setPrintFontFamily(val);
                            }
                          }}
                        >
                          <SelectTrigger className="w-full text-xs">
                            <SelectValue placeholder="اختر الخط" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Tajawal">تجوال (Tajawal) - افتراضي</SelectItem>
                            <SelectItem value="Cairo">كايرو (Cairo)</SelectItem>
                            <SelectItem value="Almarai">المراعي (Almarai)</SelectItem>
                            <SelectItem value="Amiri">أميري (Amiri)</SelectItem>
                            <SelectItem value="Changa">تشانجا (Changa)</SelectItem>
                            <SelectItem value="Segoe UI">خط النظام (Segoe UI)</SelectItem>
                            {customFontName && (
                              <SelectItem value={customFontName}>
                                الخط المرفوع: {customFontName}
                              </SelectItem>
                            )}
                            <SelectItem value="custom">رفع خط مخصص... (+)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {(printFontFamily === "custom" || printFontFamily === customFontName || customFontData) && (
                        <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/30">
                          <p className="text-[11px] font-bold text-amber-600">خط مخصص مرفوع</p>
                          
                          <div className="space-y-1">
                            <Label className="text-xs">اسم الخط المخصص</Label>
                            <Input
                              value={customFontName}
                              onChange={(e) => {
                                const newName = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
                                if (printFontFamily === customFontName) {
                                  setPrintFontFamily(newName);
                                }
                                setCustomFontName(newName);
                              }}
                              placeholder="مثال: MyCustomFont"
                              className="h-8 text-xs"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs">ملف الخط (ttf, otf, woff, woff2)</Label>
                            <div className="flex gap-2">
                              <input
                                type="file"
                                accept=".ttf,.otf,.woff,.woff2"
                                onChange={handleFontUpload}
                                className="hidden"
                                id="font-upload-input"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full text-xs h-8 cursor-pointer flex gap-1 items-center justify-center"
                                onClick={() => document.getElementById("font-upload-input")?.click()}
                              >
                                <Upload className="h-3 w-3" />
                                {customFontData ? "تغيير ملف الخط المرفوع" : "اختر ملف الخط وارفعه"}
                              </Button>

                              {customFontData && (
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  className="h-8 w-8 cursor-pointer shrink-0"
                                  onClick={() => {
                                    setCustomFontData("");
                                    setCustomFontName("");
                                    setPrintFontFamily("Tajawal");
                                    toast.success("تم حذف الخط المخصص والرجوع للخط الافتراضي");
                                  }}
                                  title="حذف الخط المخصص"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            {customFontData && (
                              <p className="text-[10px] text-green-600 bg-green-50/50 p-1.5 rounded text-center border border-green-200/50">
                                ✓ ملف الخط محمل ومحفوظ في الإعدادات
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ZoomIn className="h-4 w-4" />
                        تكبير وتصغير حجم الطباعة (Zoom)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                        💡 يمكنك تصغير أو تكبير حجم جميع عناصر الصفحة والجداول والمجاميع بنسبة معينة لتناسب حجم الورق ومساحة العرض وتفادي التداخل.
                      </p>
                      <SliderInput 
                        label="نسبة التكبير/التصغير" 
                        value={printZoomPercent} 
                        onChange={setPrintZoomPercent}
                        min={50}
                        max={150}
                        unit="%"
                      />
                    </CardContent>
                  </Card>

                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Layout className="h-4 w-4" />
                        الهوامش
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                        💡 الهوامش تُطبق على كل صفحة تلقائياً. عند امتلاء الصفحة ينتقل المحتوى للصفحة التالية مع الحفاظ على نفس الهوامش والتصميم.
                      </p>
                      <SliderInput 
                        label="الهامش العلوي" 
                        value={padTop} 
                        onChange={setPadTop}
                        min={10}
                        max={100}
                        unit="mm"
                      />
                      <SliderInput 
                        label="الهامش الأيمن" 
                        value={padRight} 
                        onChange={setPadRight}
                        min={5}
                        max={40}
                        unit="mm"
                      />
                      <SliderInput 
                        label="الهامش الأيسر" 
                        value={padLeft} 
                        onChange={setPadLeft}
                        min={5}
                        max={40}
                        unit="mm"
                      />
                      <SliderInput 
                        label="الهامش السفلي" 
                        value={padBottom} 
                        onChange={setPadBottom}
                        min={10}
                        max={60}
                        unit="mm"
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Footer Tab */}
                <TabsContent value="footer" className="space-y-6 mt-0">
                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlignVerticalJustifyStart className="h-4 w-4" />
                        إعدادات التذييل
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>تفعيل التذييل</Label>
                        <Switch
                          checked={footerEnabled}
                          onCheckedChange={setFooterEnabled}
                        />
                      </div>
                      
                      {footerEnabled && (
                        <>
                          <SliderInput 
                            label="ارتفاع التذييل" 
                            value={footerHeight} 
                            onChange={setFooterHeight}
                            min={5}
                            max={30}
                            unit="mm"
                          />
                          <SliderInput 
                            label="المسافة من الأسفل" 
                            value={footerBottom} 
                            onChange={setFooterBottom}
                            min={5}
                            max={40}
                            unit="mm"
                          />
                          <div className="space-y-2 mt-4">
                            <Label>موقع تاريخ الطباعة</Label>
                            <Select value={printDatePosition} onValueChange={setPrintDatePosition}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="اختر موقع التاريخ" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="bottom_left">أسفل اليسار (افتراضي)</SelectItem>
                                <SelectItem value="bottom_right">أسفل اليمين</SelectItem>
                                <SelectItem value="top_left">أعلى اليسار</SelectItem>
                                <SelectItem value="top_right">أعلى اليمين</SelectItem>
                                <SelectItem value="hide">إخفاء</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Contracts Print Config Tab */}
                <TabsContent value="contracts_config" className="space-y-6 mt-0">
                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileSignature className="h-4 w-4 text-primary" />
                        تخطيط وتصميم طباعة العقود
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label>موقع الشعار</Label>
                          <select
                            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs"
                            value={contractLogoPosition}
                            onChange={(e) => setContractLogoPosition(e.target.value)}
                          >
                            <option value="right">يمين (الافتراضي)</option>
                            <option value="left">يسار</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>عنوان العقد في الطباعة</Label>
                          <Input
                            value={contractTitleText}
                            onChange={(e) => setContractTitleText(e.target.value)}
                            placeholder="عـقـد مـقـاولـة"
                            className="h-9 text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-3 pt-2">
                        <Label className="text-xs font-semibold">ألوان طباعة العقود</Label>
                        <div className="space-y-3">
                          <ColorInput 
                            label="لون خلفية رأس العقد" 
                            value={contractHeaderBg} 
                            onChange={setContractHeaderBg}
                          />
                          <ColorInput 
                            label="لون نص رأس العقد" 
                            value={contractHeaderText} 
                            onChange={setContractHeaderText}
                          />
                          <ColorInput 
                            label="اللون المميز (أكسنت)" 
                            value={contractAccent} 
                            onChange={setContractAccent}
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 pt-2">
                        <div className="space-y-1.5">
                          <Label>حجم خط العنوان (pt)</Label>
                          <Input
                            type="number"
                            value={contractFontSizeTitle}
                            onChange={(e) => setContractFontSizeTitle(Number(e.target.value))}
                            min={12}
                            max={28}
                            className="h-9 text-xs"
                            dir="ltr"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>حجم خط المحتوى (pt)</Label>
                          <Input
                            type="number"
                            value={contractFontSizeBody}
                            onChange={(e) => setContractFontSizeBody(Number(e.target.value))}
                            min={8}
                            max={16}
                            className="h-9 text-xs"
                            dir="ltr"
                          />
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-border">
                        <Label className="text-xs font-semibold">مسميات أطراف التوقيع</Label>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-[10px]">الطرف الأول</Label>
                            <Input
                              value={contractSigLabel1}
                              onChange={(e) => setContractSigLabel1(e.target.value)}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">الطرف الثاني</Label>
                            <Input
                              value={contractSigLabel2}
                              onChange={(e) => setContractSigLabel2(e.target.value)}
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 pt-3 border-t border-border">
                        <Label className="text-xs font-semibold">الأقسام المعروضة في الطباعة</Label>
                        <div className="grid gap-2">
                          {[
                            { label: "معلومات المشروع والعميل", value: contractShowProjectInfo, setter: setContractShowProjectInfo },
                            { label: "وصف العقد", value: contractShowDescription, setter: setContractShowDescription },
                            { label: "جدول الكميات والأسعار", value: contractShowItemsTable, setter: setContractShowItemsTable },
                            { label: "شروط وأحكام العقد", value: contractShowClauses, setter: setContractShowClauses },
                            { label: "قسم التوقيعات", value: contractShowSignatures, setter: setContractShowSignatures },
                          ].map((item) => (
                            <label key={item.label} className="flex items-center gap-2 cursor-pointer py-0.5">
                              <input
                                type="checkbox"
                                checked={item.value}
                                onChange={(e) => item.setter(e.target.checked)}
                                className="w-3.5 h-3.5 cursor-pointer rounded border-gray-300 text-primary focus:ring-primary"
                              />
                              <span className="text-xs select-none">{item.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Print Elements Tab */}
                <TabsContent value="elements" className="space-y-4 mt-0">
                  <Tabs value={activeElementTab} onValueChange={setActiveElementTab} className="w-full">
                    <TabsList className="w-full grid grid-cols-4 mb-3 h-auto">
                      <TabsTrigger value="purchases" className="text-[10px] px-1 py-1.5 flex flex-col gap-0.5">
                        <ShoppingCart className="h-3 w-3" />
                        مشتريات
                      </TabsTrigger>
                      <TabsTrigger value="expenses" className="text-[10px] px-1 py-1.5 flex flex-col gap-0.5">
                        <Wallet className="h-3 w-3" />
                        مصروفات
                      </TabsTrigger>
                      <TabsTrigger value="equipment_rentals" className="text-[10px] px-1 py-1.5 flex flex-col gap-0.5">
                        <Truck className="h-3 w-3" />
                        إيجارات
                      </TabsTrigger>
                      <TabsTrigger value="technician_dues" className="text-[10px] px-1 py-1.5 flex flex-col gap-0.5">
                        <Users className="h-3 w-3" />
                        فنيين
                      </TabsTrigger>
                    </TabsList>
                    <TabsList className="w-full grid grid-cols-3 mb-3 h-auto">
                      <TabsTrigger value="project_report" className="text-[10px] px-1 py-1.5 flex flex-col gap-0.5">
                        <ClipboardList className="h-3 w-3" />
                        تقارير
                      </TabsTrigger>
                      <TabsTrigger value="phase_report" className="text-[10px] px-1 py-1.5 flex flex-col gap-0.5">
                        <Layers className="h-3 w-3" />
                        مراحل
                      </TabsTrigger>
                      <TabsTrigger value="contracts" className="text-[10px] px-1 py-1.5 flex flex-col gap-0.5">
                        <FileSignature className="h-3 w-3" />
                        عقود
                      </TabsTrigger>
                    </TabsList>

                    {/* Purchases Labels */}
                    <TabsContent value="purchases" className="space-y-3 mt-0">
                      <Card className="border-primary/20">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">تسميات فواتير المشتريات</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <LabelInput label="عنوان الفاتورة" value={printLabels.purchases.title} onChange={v => updateLabel("purchases", "title", v)} />
                          <LabelInput label="قسم البيانات" value={printLabels.purchases.info_section} onChange={v => updateLabel("purchases", "info_section", v)} />
                          <LabelInput label="قسم البنود" value={printLabels.purchases.items_section} onChange={v => updateLabel("purchases", "items_section", v)} />
                          <LabelInput label="قسم الملاحظات" value={printLabels.purchases.notes_section} onChange={v => updateLabel("purchases", "notes_section", v)} />
                          <div className="border-t pt-2 mt-2">
                            <p className="text-xs font-bold text-muted-foreground mb-2">تسميات الحقول</p>
                            <div className="grid grid-cols-2 gap-2">
                              <LabelInput label="رقم الفاتورة" value={printLabels.purchases.label_invoice_number} onChange={v => updateLabel("purchases", "label_invoice_number", v)} />
                              <LabelInput label="التاريخ" value={printLabels.purchases.label_date} onChange={v => updateLabel("purchases", "label_date", v)} />
                              <LabelInput label="المورد" value={printLabels.purchases.label_supplier} onChange={v => updateLabel("purchases", "label_supplier", v)} />
                              <LabelInput label="المشروع" value={printLabels.purchases.label_project} onChange={v => updateLabel("purchases", "label_project", v)} />
                              <LabelInput label="العميل" value={printLabels.purchases.label_client} onChange={v => updateLabel("purchases", "label_client", v)} />
                              <LabelInput label="حالة السداد" value={printLabels.purchases.label_status} onChange={v => updateLabel("purchases", "label_status", v)} />
                            </div>
                          </div>
                          <div className="border-t pt-2 mt-2">
                            <p className="text-xs font-bold text-muted-foreground mb-2">أعمدة الجدول</p>
                            <div className="grid grid-cols-3 gap-2">
                              <LabelInput label="الرقم" value={printLabels.purchases.col_number} onChange={v => updateLabel("purchases", "col_number", v)} />
                              <LabelInput label="البند" value={printLabels.purchases.col_item} onChange={v => updateLabel("purchases", "col_item", v)} />
                              <LabelInput label="الوحدة" value={printLabels.purchases.col_unit} onChange={v => updateLabel("purchases", "col_unit", v)} />
                              <LabelInput label="الكمية" value={printLabels.purchases.col_quantity} onChange={v => updateLabel("purchases", "col_quantity", v)} />
                              <LabelInput label="السعر" value={printLabels.purchases.col_price} onChange={v => updateLabel("purchases", "col_price", v)} />
                              <LabelInput label="الإجمالي" value={printLabels.purchases.col_total} onChange={v => updateLabel("purchases", "col_total", v)} />
                            </div>
                          </div>
                          <LabelInput label="تسمية الإجمالي" value={printLabels.purchases.total_label} onChange={v => updateLabel("purchases", "total_label", v)} />
                          <div className="flex items-center justify-between pt-2">
                            <Label className="text-xs">إظهار الملاحظات</Label>
                            <Switch checked={printLabels.purchases.show_notes} onCheckedChange={v => updateLabel("purchases", "show_notes", v)} />
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Expenses Labels */}
                    <TabsContent value="expenses" className="space-y-3 mt-0">
                      <Card className="border-primary/20">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">تسميات تقرير المصروفات</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <LabelInput label="العنوان" value={printLabels.expenses.title} onChange={v => updateLabel("expenses", "title", v)} />
                          <div className="border-t pt-2 mt-2">
                            <p className="text-xs font-bold text-muted-foreground mb-2">أعمدة الجدول</p>
                            <div className="grid grid-cols-3 gap-2">
                              <LabelInput label="الرقم" value={printLabels.expenses.col_number} onChange={v => updateLabel("expenses", "col_number", v)} />
                              <LabelInput label="الوصف" value={printLabels.expenses.col_description} onChange={v => updateLabel("expenses", "col_description", v)} />
                              <LabelInput label="النوع" value={printLabels.expenses.col_type} onChange={v => updateLabel("expenses", "col_type", v)} />
                              <LabelInput label="التاريخ" value={printLabels.expenses.col_date} onChange={v => updateLabel("expenses", "col_date", v)} />
                              <LabelInput label="طريقة الدفع" value={printLabels.expenses.col_payment_method} onChange={v => updateLabel("expenses", "col_payment_method", v)} />
                              <LabelInput label="المبلغ" value={printLabels.expenses.col_amount} onChange={v => updateLabel("expenses", "col_amount", v)} />
                            </div>
                          </div>
                          <LabelInput label="تسمية الإجمالي" value={printLabels.expenses.total_label} onChange={v => updateLabel("expenses", "total_label", v)} />
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Equipment Rentals Labels */}
                    <TabsContent value="equipment_rentals" className="space-y-3 mt-0">
                      <Card className="border-primary/20">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">تسميات إيجارات المعدات</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <LabelInput label="العنوان" value={printLabels.equipment_rentals.title} onChange={v => updateLabel("equipment_rentals", "title", v)} />
                          <div className="border-t pt-2 mt-2">
                            <p className="text-xs font-bold text-muted-foreground mb-2">أعمدة الجدول</p>
                            <div className="grid grid-cols-2 gap-2">
                              <LabelInput label="الرقم" value={printLabels.equipment_rentals.col_number} onChange={v => updateLabel("equipment_rentals", "col_number", v)} />
                              <LabelInput label="المعدة" value={printLabels.equipment_rentals.col_equipment} onChange={v => updateLabel("equipment_rentals", "col_equipment", v)} />
                              <LabelInput label="تاريخ البداية" value={printLabels.equipment_rentals.col_start_date} onChange={v => updateLabel("equipment_rentals", "col_start_date", v)} />
                              <LabelInput label="تاريخ النهاية" value={printLabels.equipment_rentals.col_end_date} onChange={v => updateLabel("equipment_rentals", "col_end_date", v)} />
                              <LabelInput label="عدد الأيام" value={printLabels.equipment_rentals.col_days} onChange={v => updateLabel("equipment_rentals", "col_days", v)} />
                              <LabelInput label="السعر اليومي" value={printLabels.equipment_rentals.col_daily_rate} onChange={v => updateLabel("equipment_rentals", "col_daily_rate", v)} />
                              <LabelInput label="الإجمالي" value={printLabels.equipment_rentals.col_total} onChange={v => updateLabel("equipment_rentals", "col_total", v)} />
                              <LabelInput label="الحالة" value={printLabels.equipment_rentals.col_status} onChange={v => updateLabel("equipment_rentals", "col_status", v)} />
                            </div>
                          </div>
                          <div className="border-t pt-2 mt-2">
                            <p className="text-xs font-bold text-muted-foreground mb-2">تسميات الإجماليات</p>
                            <LabelInput label="إجمالي الإيجار" value={printLabels.equipment_rentals.rental_total_label} onChange={v => updateLabel("equipment_rentals", "rental_total_label", v)} />
                            <LabelInput label="إجمالي الأضرار" value={printLabels.equipment_rentals.damage_total_label} onChange={v => updateLabel("equipment_rentals", "damage_total_label", v)} />
                            <LabelInput label="الإجمالي الكلي" value={printLabels.equipment_rentals.grand_total_label} onChange={v => updateLabel("equipment_rentals", "grand_total_label", v)} />
                            <LabelInput label="المبلغ المستحق" value={printLabels.equipment_rentals.total_due_label} onChange={v => updateLabel("equipment_rentals", "total_due_label", v)} />
                          </div>
                          <div className="flex items-center justify-between pt-2">
                            <Label className="text-xs">إظهار قسم الأضرار</Label>
                            <Switch checked={printLabels.equipment_rentals.show_damage_section} onCheckedChange={v => updateLabel("equipment_rentals", "show_damage_section", v)} />
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Technician Dues Labels */}
                    <TabsContent value="technician_dues" className="space-y-3 mt-0">
                      <Card className="border-primary/20">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">تسميات مستحقات الفنيين</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <LabelInput label="العنوان" value={printLabels.technician_dues.title} onChange={v => updateLabel("technician_dues", "title", v)} />
                          <LabelInput label="قسم السجلات" value={printLabels.technician_dues.records_section} onChange={v => updateLabel("technician_dues", "records_section", v)} />
                          <div className="border-t pt-2 mt-2">
                            <p className="text-xs font-bold text-muted-foreground mb-2">أعمدة الجدول</p>
                            <div className="grid grid-cols-2 gap-2">
                              <LabelInput label="التاريخ" value={printLabels.technician_dues.col_date} onChange={v => updateLabel("technician_dues", "col_date", v)} />
                              <LabelInput label="الفني" value={printLabels.technician_dues.col_technician} onChange={v => updateLabel("technician_dues", "col_technician", v)} />
                              <LabelInput label="المنجز" value={printLabels.technician_dues.col_completed} onChange={v => updateLabel("technician_dues", "col_completed", v)} />
                              <LabelInput label="النسبة" value={printLabels.technician_dues.col_percent} onChange={v => updateLabel("technician_dues", "col_percent", v)} />
                              <LabelInput label="المستحقات" value={printLabels.technician_dues.col_dues} onChange={v => updateLabel("technician_dues", "col_dues", v)} />
                              <LabelInput label="ملاحظات" value={printLabels.technician_dues.col_notes} onChange={v => updateLabel("technician_dues", "col_notes", v)} />
                            </div>
                          </div>
                          <LabelInput label="تسمية الإجمالي" value={printLabels.technician_dues.total_label} onChange={v => updateLabel("technician_dues", "total_label", v)} />
                          <div className="flex items-center justify-between pt-2">
                            <Label className="text-xs">إظهار سجل الإنجازات</Label>
                            <Switch checked={printLabels.technician_dues.show_records} onCheckedChange={v => updateLabel("technician_dues", "show_records", v)} />
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Project Report Labels */}
                    <TabsContent value="project_report" className="space-y-3 mt-0">
                      <Card className="border-primary/20">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">تسميات تقارير المشاريع</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <LabelInput label="عنوان التقرير" value={printLabels.project_report.title} onChange={v => updateLabel("project_report", "title", v)} />
                          <div className="border-t pt-2 mt-2">
                            <p className="text-xs font-bold text-muted-foreground mb-2">عناوين الأقسام</p>
                            <LabelInput label="معلومات المشروع" value={printLabels.project_report.project_info} onChange={v => updateLabel("project_report", "project_info", v)} />
                            <LabelInput label="البنود" value={printLabels.project_report.items_section} onChange={v => updateLabel("project_report", "items_section", v)} />
                            <LabelInput label="المشتريات" value={printLabels.project_report.purchases_section} onChange={v => updateLabel("project_report", "purchases_section", v)} />
                            <LabelInput label="المصروفات" value={printLabels.project_report.expenses_section} onChange={v => updateLabel("project_report", "expenses_section", v)} />
                            <LabelInput label="الدفعات" value={printLabels.project_report.payments_section} onChange={v => updateLabel("project_report", "payments_section", v)} />
                            <LabelInput label="الملخص المالي" value={printLabels.project_report.financial_summary} onChange={v => updateLabel("project_report", "financial_summary", v)} />
                          </div>
                          <div className="border-t pt-2 mt-2">
                            <p className="text-xs font-bold text-muted-foreground mb-2">تسميات الحقول</p>
                            <div className="grid grid-cols-2 gap-2">
                              <LabelInput label="اسم المشروع" value={printLabels.project_report.label_project_name} onChange={v => updateLabel("project_report", "label_project_name", v)} />
                              <LabelInput label="العميل" value={printLabels.project_report.label_client} onChange={v => updateLabel("project_report", "label_client", v)} />
                              <LabelInput label="الموقع" value={printLabels.project_report.label_location} onChange={v => updateLabel("project_report", "label_location", v)} />
                              <LabelInput label="تاريخ البدء" value={printLabels.project_report.label_start_date} onChange={v => updateLabel("project_report", "label_start_date", v)} />
                              <LabelInput label="تاريخ الانتهاء" value={printLabels.project_report.label_end_date} onChange={v => updateLabel("project_report", "label_end_date", v)} />
                              <LabelInput label="الميزانية" value={printLabels.project_report.label_budget} onChange={v => updateLabel("project_report", "label_budget", v)} />
                              <LabelInput label="الحالة" value={printLabels.project_report.label_status} onChange={v => updateLabel("project_report", "label_status", v)} />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Phase Report Labels */}
                    <TabsContent value="phase_report" className="space-y-3 mt-0">
                      <Card className="border-primary/20">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">تسميات تقارير المراحل</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <LabelInput label="عنوان التقرير" value={printLabels.phase_report.title} onChange={v => updateLabel("phase_report", "title", v)} />
                          <div className="border-t pt-2 mt-2">
                            <p className="text-xs font-bold text-muted-foreground mb-2">عناوين الأقسام</p>
                            <LabelInput label="معلومات المرحلة" value={printLabels.phase_report.phase_info} onChange={v => updateLabel("phase_report", "phase_info", v)} />
                            <LabelInput label="البنود" value={printLabels.phase_report.items_section} onChange={v => updateLabel("phase_report", "items_section", v)} />
                            <LabelInput label="المشتريات" value={printLabels.phase_report.purchases_section} onChange={v => updateLabel("phase_report", "purchases_section", v)} />
                            <LabelInput label="المصروفات" value={printLabels.phase_report.expenses_section} onChange={v => updateLabel("phase_report", "expenses_section", v)} />
                            <LabelInput label="الإيجارات" value={printLabels.phase_report.rentals_section} onChange={v => updateLabel("phase_report", "rentals_section", v)} />
                            <LabelInput label="الملخص المالي" value={printLabels.phase_report.financial_summary} onChange={v => updateLabel("phase_report", "financial_summary", v)} />
                          </div>
                          <div className="border-t pt-2 mt-2">
                            <p className="text-xs font-bold text-muted-foreground mb-2">تسميات الحقول</p>
                            <div className="grid grid-cols-2 gap-2">
                              <LabelInput label="اسم المرحلة" value={printLabels.phase_report.label_phase_name} onChange={v => updateLabel("phase_report", "label_phase_name", v)} />
                              <LabelInput label="الرقم المرجعي" value={printLabels.phase_report.label_reference} onChange={v => updateLabel("phase_report", "label_reference", v)} />
                              <LabelInput label="تاريخ البدء" value={printLabels.phase_report.label_start_date} onChange={v => updateLabel("phase_report", "label_start_date", v)} />
                              <LabelInput label="تاريخ الانتهاء" value={printLabels.phase_report.label_end_date} onChange={v => updateLabel("phase_report", "label_end_date", v)} />
                              <LabelInput label="الحالة" value={printLabels.phase_report.label_status} onChange={v => updateLabel("phase_report", "label_status", v)} />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Contracts Labels */}
                    <TabsContent value="contracts" className="space-y-3 mt-0">
                      <Card className="border-primary/20">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">تسميات العقود</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <LabelInput label="عنوان العقد" value={printLabels.contracts.title} onChange={v => updateLabel("contracts", "title", v)} />
                          <div className="border-t pt-2 mt-2">
                            <p className="text-xs font-bold text-muted-foreground mb-2">عناوين الأقسام</p>
                            <LabelInput label="معلومات العقد" value={printLabels.contracts.info_section} onChange={v => updateLabel("contracts", "info_section", v)} />
                            <LabelInput label="جدول الكميات" value={printLabels.contracts.items_section} onChange={v => updateLabel("contracts", "items_section", v)} />
                            <LabelInput label="الشروط والأحكام" value={printLabels.contracts.clauses_section} onChange={v => updateLabel("contracts", "clauses_section", v)} />
                            <LabelInput label="التوقيعات" value={printLabels.contracts.signatures_section} onChange={v => updateLabel("contracts", "signatures_section", v)} />
                            <LabelInput label="وصف العقد" value={printLabels.contracts.description_section} onChange={v => updateLabel("contracts", "description_section", v)} />
                          </div>
                          <div className="border-t pt-2 mt-2">
                            <p className="text-xs font-bold text-muted-foreground mb-2">تسميات الحقول</p>
                            <div className="grid grid-cols-2 gap-2">
                              <LabelInput label="رقم العقد" value={printLabels.contracts.label_contract_number} onChange={v => updateLabel("contracts", "label_contract_number", v)} />
                              <LabelInput label="التاريخ" value={printLabels.contracts.label_date} onChange={v => updateLabel("contracts", "label_date", v)} />
                              <LabelInput label="العميل" value={printLabels.contracts.label_client} onChange={v => updateLabel("contracts", "label_client", v)} />
                              <LabelInput label="المشروع" value={printLabels.contracts.label_project} onChange={v => updateLabel("contracts", "label_project", v)} />
                              <LabelInput label="تاريخ الانتهاء" value={printLabels.contracts.label_end_date} onChange={v => updateLabel("contracts", "label_end_date", v)} />
                              <LabelInput label="قيمة العقد" value={printLabels.contracts.label_amount} onChange={v => updateLabel("contracts", "label_amount", v)} />
                              <LabelInput label="شروط الدفع" value={printLabels.contracts.label_payment_terms} onChange={v => updateLabel("contracts", "label_payment_terms", v)} />
                            </div>
                          </div>
                          <div className="border-t pt-2 mt-2">
                            <p className="text-xs font-bold text-muted-foreground mb-2">أعمدة الجدول</p>
                            <div className="grid grid-cols-3 gap-2">
                              <LabelInput label="م" value={printLabels.contracts.col_number} onChange={v => updateLabel("contracts", "col_number", v)} />
                              <LabelInput label="البند" value={printLabels.contracts.col_item} onChange={v => updateLabel("contracts", "col_item", v)} />
                              <LabelInput label="الكمية" value={printLabels.contracts.col_quantity} onChange={v => updateLabel("contracts", "col_quantity", v)} />
                              <LabelInput label="سعر الوحدة" value={printLabels.contracts.col_unit_price} onChange={v => updateLabel("contracts", "col_unit_price", v)} />
                              <LabelInput label="الإجمالي" value={printLabels.contracts.col_total} onChange={v => updateLabel("contracts", "col_total", v)} />
                            </div>
                          </div>
                          <LabelInput label="تسمية الإجمالي" value={printLabels.contracts.total_label} onChange={v => updateLabel("contracts", "total_label", v)} />
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
        )}

        {/* Sidebar Footer - Actions */}
        {!sidebarCollapsed && (
          <div className="p-4 border-t bg-muted/30 space-y-2">
            <Button 
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="w-full cursor-pointer"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save className="ml-2 h-4 w-4" />
                  حفظ الإعدادات
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleReset}
              className="w-full cursor-pointer"
            >
              <RotateCcw className="ml-2 h-4 w-4" />
              إعادة الضبط
            </Button>
          </div>
        )}
      </div>

      {/* Preview Area */}
      <div className="flex-1 bg-muted/30 rounded-lg border p-6 overflow-auto">
        <div className="mb-4 flex items-center justify-between">
          <div></div>
          <div className="text-center">
            <h3 className="text-lg font-bold">معاينة حية للطباعة</h3>
            <p className="text-sm text-muted-foreground">التغييرات تظهر مباشرة</p>
          </div>
          <div className="flex items-center gap-2 bg-card rounded-lg border p-1">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setPreviewScale(Math.max(0.3, previewScale - 0.1))}
              disabled={previewScale <= 0.3}
              title="تصغير"
              className="cursor-pointer"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-mono w-14 text-center">{Math.round(previewScale * 100)}%</span>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setPreviewScale(Math.min(1, previewScale + 0.1))}
              disabled={previewScale >= 1}
              title="تكبير"
              className="cursor-pointer"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-1" />
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setPreviewScale(1)}
              title="الحجم الكامل"
              className="cursor-pointer"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* A4 Preview */}
        <div className="flex justify-center">
          <div 
            className="relative bg-white shadow-2xl mx-auto transition-transform duration-200" 
            style={{ 
              width: '210mm', 
              minHeight: '297mm',
              maxWidth: '100%',
              transform: `scale(${previewScale})`,
              transformOrigin: 'top center',
              fontFamily: `"${printFontFamily}", "Segoe UI", Tahoma, sans-serif`,
            }}
          >
            {(() => {
              const zoomFactor = printZoomPercent / 100;
              const scaledCellPadding = cellPadding * zoomFactor;
              const scaledTableFontSize = tableFontSize * zoomFactor;
              const scaledHeaderFontSize = headerFontSize * zoomFactor;
              const scaledTitleFontSize = titleFontSize * zoomFactor;
              const scaledHeaderFontSizeName = headerFontSizeName * zoomFactor;
              const scaledHeaderFontSizeTagline = headerFontSizeTagline * zoomFactor;
              const scaledHeaderFontSizeMeta = headerFontSizeMeta * zoomFactor;
              const scaledFooterFontSize = footerFontSize * zoomFactor;
              const scaledHeaderLogoHeight = headerLogoHeight * zoomFactor;
              const showContractPreview = activeLeftTab === "contracts_config" || (activeLeftTab === "elements" && activeElementTab === "contracts");
              const scaledContractFontSizeTitle = (contractFontSizeTitle || 18) * zoomFactor;
              const scaledContractFontSizeBody = (contractFontSizeBody || 11) * zoomFactor;

              return (
                <>
                  {/* Dynamic Font Styling Loader */}
                  <link 
                    href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;700&family=Changa:wght@400;700&family=Almarai:wght@400;700&family=Tajawal:wght@400;700&display=swap" 
                    rel="stylesheet" 
                  />
                  {customFontData && customFontName && (
                    <style dangerouslySetInnerHTML={{__html: `
                      @font-face {
                        font-family: '${customFontName}';
                        src: url(${customFontData});
                        font-weight: normal;
                        font-style: normal;
                      }
                    `}} />
                  )}
                  {/* Background Layer */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage: (!printHeaderEnabled && reportBackground) ? `url(${reportBackground})` : 'none',
                      backgroundRepeat: "no-repeat",
                      backgroundColor: "white",
                      backgroundSize: `${bgScale}%`,
                      backgroundPosition: `${bgPosX}mm ${bgPosY}mm`,
                    }}
                  />

                  {/* Unified Text Header (Preview) */}
                  {printHeaderEnabled && (
                    <div
                      style={{
                        position: 'absolute',
                        top: `${padTop}mm`,
                        left: `${padLeft}mm`,
                        right: `${padRight}mm`,
                        display: 'flex',
                        flexDirection: headerFlipped ? 'row-reverse' : 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: `2px solid ${tableBorderColor || '#ccc'}`,
                        paddingBottom: '8px',
                        direction: 'rtl',
                        zIndex: 20,
                        minHeight: `${headerHeightMm - 10}mm`,
                      }}
                    >
                      {/* Logo and company info (Swaps sides on flip) */}
                      <div className={cn("flex items-center gap-3", headerFlipped && "flex-row-reverse")}>
                        {headerShowLogo && (
                          companyLogo ? (
                            <img 
                              src={companyLogo} 
                              alt="شعار الشركة" 
                              style={{ height: `${scaledHeaderLogoHeight}px`, width: 'auto', objectFit: 'contain' }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://placehold.co/100x50?text=Logo';
                              }}
                            />
                          ) : (
                            <div 
                              className="bg-muted rounded flex items-center justify-center text-[8px] text-muted-foreground border"
                              style={{ height: `${scaledHeaderLogoHeight}px`, width: `${scaledHeaderLogoHeight}px` }}
                            >
                              لا يوجد شعار
                            </div>
                          )
                        )}
                        <div className={headerFlipped ? "text-left" : "text-right"}>
                          {headerShowName && (
                            <h2 
                              className="font-bold text-gray-800"
                              style={{ fontSize: `${scaledHeaderFontSizeName}px` }}
                            >
                              {companyName || "اسم الشركة"}
                            </h2>
                          )}
                          {headerShowTagline && (
                            <p 
                              className="text-muted-foreground"
                              style={{ fontSize: `${scaledHeaderFontSizeTagline}px` }}
                            >
                              {companyTagline}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Date and Transaction details (Swaps sides on flip) */}
                      <div 
                        className={headerFlipped ? "text-right" : "text-left"} 
                        style={{ 
                          direction: headerFlipped ? 'rtl' : 'ltr',
                          fontSize: `${scaledHeaderFontSizeMeta}px`,
                          color: '#4b5563'
                        }}
                      >
                        <p>Date: {new Date().toLocaleDateString('en-US')}</p>
                        <p>Transaction: 001/2026</p>
                        <p>Description: Live Layout Preview</p>
                      </div>
                    </div>
                  )}

                  {/* مؤشرات الهوامش - خطوط متقطعة تظهر حدود منطقة المحتوى */}
                  <div
                    style={{
                      position: 'absolute',
                      top: `${padTop}mm`,
                      right: `${padRight}mm`,
                      bottom: `${padBottom}mm`,
                      left: `${padLeft}mm`,
                      border: '1px dashed rgba(99, 102, 241, 0.3)',
                      pointerEvents: 'none',
                      zIndex: 10,
                    }}
                  />

                  {/* Content Area - بدون max-height لأن المحتوى ينتقل لصفحة جديدة */}
                  <div
                    style={{
                      position: 'absolute',
                      top: `${printHeaderEnabled ? (padTop + headerHeightMm) : padTop}mm`,
                      right: `${padRight}mm`,
                      left: `${padLeft}mm`,
                      bottom: `${footerEnabled ? (padBottom + footerHeight) : padBottom}mm`,
                      overflow: 'hidden',
                      direction: 'rtl',
                    }}
                  >
                    <div>
                      {showContractPreview ? (
                        <div style={{ fontSize: `${scaledContractFontSizeBody}px`, direction: 'rtl', padding: '10px' }}>
                          {/* Contract Title Block */}
                          <div style={{ textAlign: 'center', marginBottom: '24px', paddingBottom: '12px', borderBottom: `2px dashed ${contractAccent || '#c6973f'}` }}>
                            <h1 style={{ fontSize: `${scaledContractFontSizeTitle}px`, fontWeight: 'bold', color: contractAccent || '#c6973f', margin: 0 }}>
                              {contractTitleText || "عـقـد مـقـاولـة"}
                            </h1>
                          </div>

                          {/* Project & Client Cards */}
                          {contractShowProjectInfo && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                              <div style={{ gridColumn: 'span 2', border: `1.5px solid ${contractAccent || '#c6973f'}`, borderRadius: '6px', overflow: 'hidden' }}>
                                <div style={{ backgroundColor: contractHeaderBg || '#1a365d', color: contractHeaderText || '#ffffff', fontSize: `${scaledContractFontSizeBody - 2}px`, padding: '4px 10px', fontWeight: 'bold' }}>
                                  وصف الأعمال والتمهيد
                                </div>
                                <div style={{ padding: '8px', color: '#333', fontSize: `${scaledContractFontSizeBody - 1}px`, backgroundColor: '#fafafa' }}>
                                  يتعهد المقاول بتنفيذ أعمال الهيكل الخرساني والإنشاءات للمبنى السكني التجاري المتفق عليه مع الطرف الأول.
                                </div>
                              </div>
                              <div style={{ border: `1.5px solid ${contractAccent || '#c6973f'}`, borderRadius: '6px', overflow: 'hidden' }}>
                                <div style={{ backgroundColor: contractHeaderBg || '#1a365d', color: contractHeaderText || '#ffffff', fontSize: `${scaledContractFontSizeBody - 2}px`, padding: '4px 10px', fontWeight: 'bold' }}>
                                  الطرف الأول (الشركة)
                                </div>
                                <div style={{ padding: '8px', color: '#333', fontSize: `${scaledContractFontSizeBody - 1}px`, backgroundColor: '#fafafa' }}>
                                  شركة ركاز العقارية
                                </div>
                              </div>
                              <div style={{ border: `1.5px solid ${contractAccent || '#c6973f'}`, borderRadius: '6px', overflow: 'hidden' }}>
                                <div style={{ backgroundColor: contractHeaderBg || '#1a365d', color: contractHeaderText || '#ffffff', fontSize: `${scaledContractFontSizeBody - 2}px`, padding: '4px 10px', fontWeight: 'bold' }}>
                                  الطرف الثاني (العميل)
                                </div>
                                <div style={{ padding: '8px', color: '#333', fontSize: `${scaledContractFontSizeBody - 1}px`, backgroundColor: '#fafafa' }}>
                                  ناصر ابراهيم الدويبي
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Clauses Section */}
                          {contractShowClauses && (
                            <div style={{ marginBottom: '20px' }}>
                              <div style={{ borderRight: `4px solid ${contractAccent || '#c6973f'}`, paddingRight: '8px', marginBottom: '10px', color: contractAccent || '#c6973f', fontWeight: 'bold', fontSize: `${scaledContractFontSizeBody + 1}px` }}>
                                شروط وأحكام العقد العامة
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', gap: '10px', fontSize: `${scaledContractFontSizeBody - 1}px` }}>
                                  <div style={{ minWidth: '20px', height: '20px', borderRadius: '50%', border: `1.5px solid ${contractAccent || '#c6973f'}`, backgroundColor: '#fdfbf7', color: contractAccent || '#c6973f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '9px' }}>١</div>
                                  <div><strong>التمهيد والالتزام:</strong> يعتبر التمهيد جزءاً لا يتجزأ من هذا العقد وشروطه ملزمة لكلا الطرفين.</div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', fontSize: `${scaledContractFontSizeBody - 1}px` }}>
                                  <div style={{ minWidth: '20px', height: '20px', borderRadius: '50%', border: `1.5px solid ${contractAccent || '#c6973f'}`, backgroundColor: '#fdfbf7', color: contractAccent || '#c6973f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '9px' }}>٢</div>
                                  <div><strong>المواصفات القياسية:</strong> تتم كافة الأعمال طبقاً للرسومات الهندسية المعتمدة وتحت إشراف المهندس المعين.</div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Table of Items */}
                          {contractShowItemsTable && (
                            <div style={{ marginBottom: '20px' }}>
                              <div style={{ borderRight: `4px solid ${contractAccent || '#c6973f'}`, paddingRight: '8px', marginBottom: '10px', color: contractAccent || '#c6973f', fontWeight: 'bold', fontSize: `${scaledContractFontSizeBody + 1}px` }}>
                                الفئات والأسعار المتفق عليها
                              </div>
                              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, border: `1.5px solid ${contractAccent || '#c6973f'}`, borderRadius: '6px', overflow: 'hidden', fontSize: `${scaledContractFontSizeBody - 1}px` }}>
                                <thead>
                                  <tr style={{ backgroundColor: contractHeaderBg || '#1a365d', color: contractHeaderText || '#ffffff' }}>
                                    <th style={{ padding: '6px', borderBottom: `1.5px solid ${contractAccent || '#c6973f'}`, fontWeight: 'bold', textAlign: 'center', width: '10%' }}>ر.م</th>
                                    <th style={{ padding: '6px', borderBottom: `1.5px solid ${contractAccent || '#c6973f'}`, fontWeight: 'bold', textAlign: 'right', width: '65%' }}>بيان البنود والأعمال</th>
                                    <th style={{ padding: '6px', borderBottom: `1.5px solid ${contractAccent || '#c6973f'}`, fontWeight: 'bold', textAlign: 'center', width: '25%' }}>سعر الوحدة المتفق عليه</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr style={{ backgroundColor: '#ffffff' }}>
                                    <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'center' }}>١</td>
                                    <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 'bold' }}>الأعمدة (خرسانة مسلحة)</td>
                                    <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'center', fontWeight: 'bold', color: '#16a34a' }}>١٧٠ د.ل</td>
                                  </tr>
                                  <tr style={{ backgroundColor: '#fdfdfd' }}>
                                    <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'center' }}>٢</td>
                                    <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 'bold' }}>الكمر الساقط</td>
                                    <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'center', fontWeight: 'bold', color: '#16a34a' }}>١٧٠ د.ل</td>
                                  </tr>
                                  <tr style={{ backgroundColor: '#ffffff' }}>
                                    <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'center' }}>٣</td>
                                    <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 'bold' }}>حوائط المصعد</td>
                                    <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'center', fontWeight: 'bold', color: '#16a34a' }}>١٧٠ د.ل</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* Signatures Section */}
                          {contractShowSignatures && (
                            <div style={{ marginTop: '20px' }}>
                              <div style={{ borderRight: `4px solid ${contractAccent || '#c6973f'}`, paddingRight: '8px', marginBottom: '10px', color: contractAccent || '#c6973f', fontWeight: 'bold', fontSize: `${scaledContractFontSizeBody + 1}px` }}>
                                التوقيعات والاعتماد
                              </div>
                              <div style={{ display: 'flex', gap: '12px' }}>
                                <div style={{ flex: 1, border: `1.5px solid ${contractAccent || '#c6973f'}`, borderRadius: '6px', overflow: 'hidden', textAlign: 'center', backgroundColor: '#ffffff' }}>
                                  <div style={{ backgroundColor: contractHeaderBg || '#1a365d', color: contractHeaderText || '#ffffff', padding: '4px', fontWeight: 'bold', fontSize: `${scaledContractFontSizeBody - 2}px` }}>
                                    {contractSigLabel1 || "الطرف الأول"}
                                  </div>
                                  <div style={{ padding: '8px' }}>
                                    <div style={{ fontWeight: 'bold', fontSize: `${scaledContractFontSizeBody - 1}px`, marginBottom: '12px' }}>مجموعة ركاز العقارية</div>
                                    <div style={{ borderTop: '1px dashed #ccc', height: '24px', marginTop: '10px' }} />
                                  </div>
                                </div>
                                <div style={{ flex: 1, border: `1.5px solid ${contractAccent || '#c6973f'}`, borderRadius: '6px', overflow: 'hidden', textAlign: 'center', backgroundColor: '#ffffff' }}>
                                  <div style={{ backgroundColor: contractHeaderBg || '#1a365d', color: contractHeaderText || '#ffffff', padding: '4px', fontWeight: 'bold', fontSize: `${scaledContractFontSizeBody - 2}px` }}>
                                    {contractSigLabel2 || "الطرف الثاني"}
                                  </div>
                                  <div style={{ padding: '8px' }}>
                                    <div style={{ fontWeight: 'bold', fontSize: `${scaledContractFontSizeBody - 1}px`, marginBottom: '12px' }}>ناصر ابراهيم الدويبي</div>
                                    <div style={{ borderTop: '1px dashed #ccc', height: '24px', marginTop: '10px' }} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          {/* Section Title */}
                          <div 
                            style={{ 
                              color: sectionTitleColor,
                              fontSize: `${scaledTitleFontSize}px`,
                              fontWeight: 'bold',
                              borderBottom: `2px solid ${sectionTitleColor}`,
                              paddingBottom: '8px',
                              marginBottom: '16px',
                            }}
                          >
                            بنود المشروع
                          </div>

                          {/* Sample Table */}
                          <table 
                            style={{ 
                              width: '100%', 
                              borderCollapse: 'separate',
                              borderSpacing: 0,
                              border: `${borderWidth}px solid ${tableBorderColor}`,
                              borderRadius: `${borderRadius}px`,
                              overflow: 'hidden',
                            }}
                          >
                            <thead>
                              <tr style={{ backgroundColor: tableHeaderColor }}>
                                {['البند', 'الكمية', 'الوحدة', 'سعر الوحدة', 'الإجمالي'].map((header, i) => (
                                  <th 
                                    key={i}
                                    style={{ 
                                      padding: `${scaledCellPadding}px`,
                                      color: headerTextColor,
                                      fontSize: `${scaledHeaderFontSize}px`,
                                      fontWeight: 'bold',
                                      textAlign: 'center',
                                      borderBottom: `${borderWidth}px solid ${tableBorderColor}`,
                                    }}
                                  >
                                    {header}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sampleTableData.map((row, idx) => (
                                <tr 
                                  key={idx}
                                  style={{ 
                                    backgroundColor: idx % 2 === 0 ? tableRowEvenColor : tableRowOddColor,
                                  }}
                                >
                                  <td style={{ 
                                    padding: `${scaledCellPadding}px`, 
                                    color: tableTextColor,
                                    fontSize: `${scaledTableFontSize}px`,
                                    textAlign: 'center',
                                    verticalAlign: 'middle',
                                    borderBottom: `${borderWidth}px solid ${tableBorderColor}`,
                                  }}>
                                    {row.name}
                                  </td>
                                  <td style={{ 
                                    padding: `${scaledCellPadding}px`, 
                                    color: tableTextColor,
                                    fontSize: `${scaledTableFontSize}px`,
                                    textAlign: 'center',
                                    verticalAlign: 'middle',
                                    borderBottom: `${borderWidth}px solid ${tableBorderColor}`,
                                  }}>
                                    {row.quantity}
                                  </td>
                                  <td style={{ 
                                    padding: `${scaledCellPadding}px`, 
                                    color: tableTextColor,
                                    fontSize: `${scaledTableFontSize}px`,
                                    textAlign: 'center',
                                    verticalAlign: 'middle',
                                    borderBottom: `${borderWidth}px solid ${tableBorderColor}`,
                                  }}>
                                    {row.unit}
                                  </td>
                                  <td style={{ 
                                    padding: `${scaledCellPadding}px`, 
                                    color: tableTextColor,
                                    fontSize: `${scaledTableFontSize}px`,
                                    textAlign: 'center',
                                    verticalAlign: 'middle',
                                    borderBottom: `${borderWidth}px solid ${tableBorderColor}`,
                                  }}>
                                    {row.price}
                                  </td>
                                  <td style={{ 
                                    padding: `${scaledCellPadding}px`, 
                                    color: tableTextColor,
                                    fontSize: `${scaledTableFontSize}px`,
                                    textAlign: 'center',
                                    verticalAlign: 'middle',
                                    fontWeight: 'bold',
                                    borderBottom: `${borderWidth}px solid ${tableBorderColor}`,
                                  }}>
                                    {row.total}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr style={{ 
                                backgroundColor: totalsBgColor,
                                borderTop: `2px double ${tableBorderColor}`,
                                borderBottom: `2px double ${tableBorderColor}`,
                              }}>
                                <td 
                                  colSpan={4} 
                                  style={{ 
                                    padding: `${scaledCellPadding}px`,
                                    color: totalsTextColor,
                                    fontSize: `${scaledTableFontSize + 1}px`,
                                    fontWeight: '800',
                                    textAlign: 'left',
                                  }}
                                >
                                  الإجمالي الكلي
                                </td>
                                <td 
                                  style={{ 
                                    padding: `${scaledCellPadding}px`,
                                    color: totalsTextColor,
                                    fontSize: `${scaledTableFontSize + 1}px`,
                                    fontWeight: '800',
                                    textAlign: 'center',
                                  }}
                                >
                                  14,550.00
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Footer — positioned just above the bottom padding, mirroring print fixed footer at bottom:0 */}
                  {footerEnabled && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: `${padBottom}mm`,
                        left: 0,
                        right: 0,
                        height: `${footerHeight}mm`,
                        paddingLeft: `${padLeft}mm`,
                        paddingRight: `${padRight}mm`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        borderTop: `1px solid ${tableBorderColor || '#ccc'}`,
                        fontSize: `${scaledFooterFontSize}px`,
                        color: '#555',
                        direction: 'rtl',
                        backgroundColor: 'white',
                        overflow: 'hidden',
                        gap: '12px',
                      }}
                    >
                      {companyPhone && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                          <Phone size={11} style={{ color: footerIconColor, flexShrink: 0 }} />
                          <span>{companyPhone}</span>
                        </span>
                      )}
                      {companyAddress && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                          <MapPin size={11} style={{ color: footerIconColor, flexShrink: 0 }} />
                          <span>{companyAddress}</span>
                        </span>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintDesign;
