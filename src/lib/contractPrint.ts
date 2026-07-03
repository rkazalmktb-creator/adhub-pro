import { generatePrintStyles, getPrintValues } from "./printStyles";
import { formatCurrencyLYD } from "./currency";
import { getElementLabels } from "./printLabels";

interface ContractPrintSettings {
  contract_logo_position?: string;
  contract_title_text?: string;
  contract_show_project_info?: boolean;
  contract_show_description?: boolean;
  contract_show_items_table?: boolean;
  contract_show_clauses?: boolean;
  contract_show_signatures?: boolean;
  contract_header_bg_color?: string;
  contract_header_text_color?: string;
  contract_accent_color?: string;
  contract_font_size_body?: number;
  contract_font_size_title?: number;
  contract_signature_labels?: string[];
  company_logo?: string | null;
  company_name?: string;
}

interface ContractPrintData {
  contract: {
    title: string;
    contract_number: string;
    start_date: string;
    end_date?: string | null;
    amount: number;
    status: string;
    payment_terms?: string | null;
    description?: string | null;
    notes?: string | null;
  };
  projectName: string;
  clientName: string;
  companyName: string;
  items: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
  clauses: Array<{
    title: string;
    content: string;
    order_index: number;
  }>;
  settings: any;
}

const statusLabels: Record<string, string> = {
  pending: "معلق",
  active: "نشط",
  completed: "مكتمل",
  cancelled: "ملغي",
};

function getContractSettings(settings: any): ContractPrintSettings {
  return {
    contract_logo_position: settings?.contract_logo_position || "right",
    contract_title_text: settings?.contract_title_text || "عـقـد مـقـاولـة",
    contract_show_project_info: settings?.contract_show_project_info !== false,
    contract_show_description: settings?.contract_show_description !== false,
    contract_show_items_table: settings?.contract_show_items_table !== false,
    contract_show_clauses: settings?.contract_show_clauses !== false,
    contract_show_signatures: settings?.contract_show_signatures !== false,
    contract_header_bg_color: settings?.contract_header_bg_color || "#1a365d",
    contract_header_text_color: settings?.contract_header_text_color || "#ffffff",
    contract_accent_color: settings?.contract_accent_color || "#c6973f",
    contract_font_size_body: Number(settings?.contract_font_size_body || 11),
    contract_font_size_title: Number(settings?.contract_font_size_title || 18),
    contract_signature_labels: Array.isArray(settings?.contract_signature_labels)
      ? settings.contract_signature_labels
      : ["الطرف الأول (صاحب العمل)", "الطرف الثاني (المقاول)"],
    company_logo: settings?.company_logo || null,
    company_name: settings?.company_name || "",
  };
}

export function printContract(data: ContractPrintData) {
  const { contract, projectName, clientName, companyName, items, clauses, settings } = data;
  const v = getPrintValues(settings);
  const cs = getContractSettings(settings);
  const pl = getElementLabels(settings?.print_labels, "contracts");

  const itemsTotal = items.reduce((sum, it) => sum + Number(it.total_price), 0);
  const contractAmount = Number(contract.amount) || itemsTotal;

  const logoOnRight = cs.contract_logo_position === "right";
  const logoUrl = cs.company_logo;

  const logoBlock = logoUrl
    ? `<div class="header-logo"><img src="${logoUrl}" alt="شعار" /></div>`
    : `<div class="header-logo"><div class="logo-placeholder">${(companyName || "").charAt(0)}</div></div>`;

  const infoBlock = `
    <div class="header-info">
      <div class="header-contract-num">${pl.label_contract_number}: <strong>${contract.contract_number}</strong></div>
      <div class="header-date">${pl.label_date}: <strong>${contract.start_date}</strong></div>
      <div class="header-client">${pl.label_client}: <strong>${clientName || "—"}</strong></div>
    </div>
  `;

  const headerContent = logoOnRight
    ? `${infoBlock}<div class="header-center-title"><div class="company-title">${companyName}</div><div class="contract-main-title">${pl.title}</div></div>${logoBlock}`
    : `${logoBlock}<div class="header-center-title"><div class="company-title">${companyName}</div><div class="contract-main-title">${pl.title}</div></div>${infoBlock}`;

  // Items table
  const itemsTableRows = items
    .map(
      (item, idx) => `
      <tr>
        <td class="cell-center">${idx + 1}</td>
        <td class="cell-name">${item.name}</td>
        <td class="cell-center">${item.quantity}</td>
        <td class="cell-center">${formatCurrencyLYD(Number(item.unit_price))}</td>
        <td class="cell-center cell-bold">${formatCurrencyLYD(Number(item.total_price))}</td>
      </tr>`
    )
    .join("");

  // Clauses
  const clausesHtml = clauses
    .sort((a, b) => a.order_index - b.order_index)
    .map(
      (clause, idx) => `
      <div class="clause-item">
        <div class="clause-number">${idx + 1}</div>
        <div class="clause-body">
          <div class="clause-title">${clause.title}</div>
          <div class="clause-content">${clause.content}</div>
        </div>
      </div>`
    )
    .join("");

  // Signature labels
  const sigLabels = cs.contract_signature_labels || ["الطرف الأول", "الطرف الثاني"];

  const baseStyles = generatePrintStyles(settings);
  const contractStyles = `
    :root {
      --c-header-bg: ${cs.contract_header_bg_color};
      --c-header-text: ${cs.contract_header_text_color};
      --c-accent: ${cs.contract_accent_color};
      --c-body-size: ${cs.contract_font_size_body}pt;
      --c-title-size: ${cs.contract_font_size_title}pt;
    }

    .print-content {
      max-height: none !important;
      font-size: var(--c-body-size);
    }

    /* ========== HEADER ========== */
    .contract-header-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--c-header-bg);
      color: var(--c-header-text);
      padding: 12px 18px;
      border-radius: 6px;
      margin-bottom: 14px;
      gap: 12px;
    }

    .header-logo img {
      max-height: 60px;
      max-width: 120px;
      object-fit: contain;
    }

    .logo-placeholder {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: var(--c-accent);
      color: var(--c-header-bg);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22pt;
      font-weight: bold;
    }

    .header-center-title {
      flex: 1;
      text-align: center;
    }

    .company-title {
      font-size: 12pt;
      opacity: 0.85;
      margin-bottom: 2px;
      letter-spacing: 1px;
    }

    .contract-main-title {
      font-size: var(--c-title-size);
      font-weight: bold;
      letter-spacing: 3px;
    }

    .header-info {
      text-align: ${logoOnRight ? "left" : "right"};
      font-size: 9pt;
      line-height: 1.8;
      min-width: 140px;
    }

    .header-info strong {
      color: var(--c-accent);
    }

    /* ========== ACCENT DIVIDER ========== */
    .accent-divider {
      height: 3px;
      background: linear-gradient(to ${logoOnRight ? "left" : "right"}, var(--c-accent), var(--c-header-bg), var(--c-accent));
      border: none;
      margin: 0 0 14px 0;
      border-radius: 2px;
    }

    /* ========== PROJECT INFO GRID ========== */
    .project-info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 14px;
    }

    .info-card {
      border: 1px solid ${v.tableBorderColor}60;
      border-radius: 4px;
      overflow: hidden;
    }

    .info-card.full-width {
      grid-column: 1 / -1;
    }

    .info-card-label {
      background: var(--c-header-bg);
      color: var(--c-header-text);
      font-size: 8pt;
      padding: 3px 8px;
      font-weight: bold;
    }

    .info-card-value {
      padding: 5px 8px;
      font-size: var(--c-body-size);
      color: ${v.tableTextColor};
    }

    .info-card-value.highlight {
      font-weight: bold;
      color: var(--c-accent);
      font-size: 12pt;
    }

    /* ========== SECTION ========== */
    .contract-section {
      margin-bottom: 14px;
      page-break-inside: avoid;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 2px solid var(--c-accent);
    }

    .section-header-icon {
      width: 24px;
      height: 24px;
      background: var(--c-header-bg);
      color: var(--c-header-text);
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11pt;
      font-weight: bold;
    }

    .section-header-text {
      font-size: 13pt;
      font-weight: bold;
      color: var(--c-header-bg);
    }

    /* ========== ITEMS TABLE ========== */
    .items-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: var(--c-body-size);
      border: 1px solid ${v.tableBorderColor};
      border-radius: 4px;
      overflow: hidden;
    }

    .items-table th {
      background: var(--c-header-bg);
      color: var(--c-header-text);
      padding: 7px 8px;
      text-align: center;
      font-size: 10pt;
      font-weight: bold;
      border-bottom: 2px solid var(--c-accent);
    }

    .items-table td {
      padding: 6px 8px;
      border-bottom: 1px solid ${v.tableBorderColor}50;
      color: ${v.tableTextColor};
    }

    .items-table tbody tr:nth-child(even) {
      background: ${v.tableRowEvenColor};
    }

    .items-table tbody tr:hover {
      background: var(--c-accent)10;
    }

    .cell-center { text-align: center; }
    .cell-name { font-weight: 500; }
    .cell-bold { font-weight: bold; color: var(--c-header-bg); }

    .items-table tfoot td {
      background: var(--c-header-bg);
      color: var(--c-header-text);
      font-weight: bold;
      padding: 8px;
      border: none;
    }

    /* ========== TOTAL BOX ========== */
    .contract-total-box {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      background: linear-gradient(135deg, var(--c-header-bg), var(--c-header-bg)dd);
      color: var(--c-header-text);
      padding: 10px 20px;
      border-radius: 6px;
      margin-top: 10px;
    }

    .contract-total-box .total-label {
      font-size: 11pt;
      opacity: 0.9;
    }

    .contract-total-box .total-value {
      font-size: 16pt;
      font-weight: bold;
      color: var(--c-accent);
    }

    /* ========== CLAUSES ========== */
    .clause-item {
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
      page-break-inside: avoid;
    }

    .clause-number {
      min-width: 26px;
      height: 26px;
      background: var(--c-header-bg);
      color: var(--c-header-text);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10pt;
      font-weight: bold;
      margin-top: 2px;
    }

    .clause-body {
      flex: 1;
    }

    .clause-title {
      font-weight: bold;
      font-size: 11pt;
      color: var(--c-header-bg);
      margin-bottom: 3px;
    }

    .clause-content {
      font-size: var(--c-body-size);
      color: ${v.tableTextColor};
      line-height: 1.9;
      text-align: justify;
      padding-right: 2px;
    }

    /* ========== DESCRIPTION ========== */
    .description-text {
      font-size: var(--c-body-size);
      color: ${v.tableTextColor};
      line-height: 1.9;
      text-align: justify;
      background: ${v.tableRowEvenColor};
      padding: 10px 12px;
      border-radius: 4px;
      border-right: 3px solid var(--c-accent);
    }

    /* ========== SIGNATURES ========== */
    .signatures-section {
      margin-top: 24px;
      page-break-inside: avoid;
    }

    .signatures-grid {
      display: flex;
      justify-content: space-between;
      gap: 30px;
      margin-top: 10px;
    }

    .signature-box {
      flex: 1;
      text-align: center;
      border: 1px solid ${v.tableBorderColor}80;
      border-radius: 6px;
      overflow: hidden;
    }

    .sig-header {
      background: var(--c-header-bg);
      color: var(--c-header-text);
      padding: 6px 10px;
      font-weight: bold;
      font-size: 10pt;
    }

    .sig-body {
      padding: 12px;
    }

    .sig-name {
      font-size: var(--c-body-size);
      color: ${v.tableTextColor};
      margin-bottom: 35px;
      font-weight: 500;
    }

    .sig-line {
      border-top: 1px dashed ${v.tableBorderColor};
      padding-top: 6px;
      font-size: 8pt;
      color: ${v.tableTextColor}99;
    }

    /* ========== WATERMARK ========== */
    .contract-watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 60pt;
      color: ${v.tableBorderColor}10;
      font-weight: bold;
      pointer-events: none;
      white-space: nowrap;
      letter-spacing: 10px;
    }
  `;

  // Contract info grid
  const projectInfoHtml = cs.contract_show_project_info ? `
    <div class="project-info-grid">
      <div class="info-card full-width">
        <div class="info-card-label">${pl.info_section}</div>
        <div class="info-card-value" style="font-weight:bold">${contract.title}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">${pl.label_project}</div>
        <div class="info-card-value">${projectName}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">${pl.label_client}</div>
        <div class="info-card-value">${clientName || "غير محدد"}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">${pl.label_date}</div>
        <div class="info-card-value">${contract.start_date}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">${pl.label_end_date}</div>
        <div class="info-card-value">${contract.end_date || "غير محدد"}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">${pl.label_amount}</div>
        <div class="info-card-value highlight">${formatCurrencyLYD(contractAmount)}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">${pl.label_payment_terms}</div>
        <div class="info-card-value">${contract.payment_terms || "غير محدد"}</div>
      </div>
    </div>
  ` : "";

  const descriptionHtml = cs.contract_show_description && contract.description ? `
    <div class="contract-section">
      <div class="section-header">
        <div class="section-header-icon">📋</div>
        <div class="section-header-text">${pl.description_section}</div>
      </div>
      <div class="description-text">${contract.description}</div>
    </div>
  ` : "";

  const itemsHtml = cs.contract_show_items_table && items.length > 0 ? `
    <div class="contract-section">
      <div class="section-header">
        <div class="section-header-icon">📦</div>
        <div class="section-header-text">${pl.items_section}</div>
      </div>
      <table class="items-table">
        <thead>
          <tr>
            <th style="width:7%">${pl.col_number}</th>
            <th>${pl.col_item}</th>
            <th style="width:12%">${pl.col_quantity}</th>
            <th style="width:17%">${pl.col_unit_price}</th>
            <th style="width:19%">${pl.col_total}</th>
          </tr>
        </thead>
        <tbody>
          ${itemsTableRows}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="text-align:center">${pl.total_label}</td>
            <td style="text-align:center; font-size:12pt">${formatCurrencyLYD(itemsTotal)}</td>
          </tr>
        </tfoot>
      </table>
      <div class="contract-total-box">
        <span class="total-label">${pl.total_label}:</span>
        <span class="total-value">${formatCurrencyLYD(contractAmount)}</span>
      </div>
    </div>
  ` : "";

  const clausesSection = cs.contract_show_clauses && clauses.length > 0 ? `
    <div class="contract-section">
      <div class="section-header">
        <div class="section-header-icon">⚖</div>
        <div class="section-header-text">${pl.clauses_section}</div>
      </div>
      ${clausesHtml}
    </div>
  ` : "";

  const signaturesHtml = cs.contract_show_signatures ? `
    <div class="signatures-section">
      <div class="section-header">
        <div class="section-header-icon">✍</div>
        <div class="section-header-text">${pl.signatures_section}</div>
      </div>
      <div class="signatures-grid">
        <div class="signature-box">
          <div class="sig-header">${sigLabels[0] || "الطرف الأول"}</div>
          <div class="sig-body">
            <div class="sig-name">${clientName || "_______________"}</div>
            <div class="sig-line">التوقيع والختم</div>
          </div>
        </div>
        <div class="signature-box">
          <div class="sig-header">${sigLabels[1] || "الطرف الثاني"}</div>
          <div class="sig-body">
            <div class="sig-name">${companyName || "_______________"}</div>
            <div class="sig-line">التوقيع والختم</div>
          </div>
        </div>
      </div>
    </div>
  ` : "";

  const content = `
    <div class="print-area">
      <div class="print-content">
        <div class="contract-header-bar">
          ${headerContent}
        </div>
        <hr class="accent-divider" />
        ${projectInfoHtml}
        ${descriptionHtml}
        ${itemsHtml}
        ${clausesSection}
        ${signaturesHtml}
      </div>

      ${v.footerEnabled ? `
        <div class="print-footer">
          <span>${companyName}</span>
          <span>عقد رقم: ${contract.contract_number}</span>
          <span>${new Date().toLocaleDateString("ar-LY")}</span>
        </div>
      ` : ""}
    </div>
  `;

  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>عقد - ${contract.title}</title>
      <style>
        ${baseStyles}
        ${contractStyles}
      </style>
    </head>
    <body>
      <div class="print-btn-container">
        <button class="print-btn" onclick="window.print()">🖨️ طباعة</button>
        <button class="print-btn close-btn" onclick="window.close()">✕ إغلاق</button>
      </div>
      ${content}
    </body>
    </html>
  `);
  printWindow.document.close();
}
