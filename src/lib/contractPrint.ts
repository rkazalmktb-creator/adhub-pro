import { generatePrintStyles, getPrintValues, openPrintWindow } from "./printStyles";
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
    measurement_factor?: number;
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
        <td class="cell-name cell-center">${item.name}</td>
        <td class="cell-center font-bold">${item.measurement_factor !== undefined ? item.measurement_factor : 1}</td>
        <td class="cell-center cell-bold">${formatCurrencyLYD(Number(item.unit_price))}</td>
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
      --c-accent: ${cs.contract_accent_color};
      --c-body-size: ${cs.contract_font_size_body}pt;
      --c-title-size: ${cs.contract_font_size_title}pt;
    }

    .print-content {
      max-height: none !important;
      font-size: var(--c-body-size);
      line-height: 1.8;
    }

    /* ========== TITLE BLOCK ========== */
    .contract-title-block {
      text-align: center;
      margin-bottom: 24px;
      padding: 16px;
      border-bottom: 2px dashed var(--c-accent);
    }
    
    .contract-main-title {
      font-size: var(--c-title-size);
      font-weight: 800;
      color: #8c6e26;
      margin-bottom: 8px;
    }
    
    .contract-meta-row {
      font-size: 10pt;
      color: #4b5563;
      display: flex;
      justify-content: center;
      gap: 16px;
    }
    
    .meta-divider {
      color: var(--c-accent);
      margin: 0 4px;
    }

    /* ========== PROJECT INFO GRID ========== */
    .project-info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 18px;
    }

    .info-card {
      border: 1px solid var(--c-accent);
      border-radius: 6px;
      overflow: hidden;
      background: #ffffff;
    }

    .info-card.full-width {
      grid-column: 1 / -1;
    }

    .info-card-label {
      background: #fdfaf2;
      color: #8c6e26;
      font-size: 8.5pt;
      padding: 4px 8px;
      font-weight: bold;
      border-bottom: 1px solid var(--c-accent);
    }

    .info-card-value {
      padding: 6px 10px;
      font-size: var(--c-body-size);
      color: ${v.tableTextColor};
    }

    .info-card-value.highlight {
      font-weight: bold;
      color: #8c6e26;
      font-size: 11pt;
    }

    /* ========== SECTION ========== */
    .contract-section {
      margin-bottom: 18px;
      page-break-inside: avoid;
    }

    .section-header {
      display: flex;
      align-items: center;
      margin-bottom: 10px;
      padding-bottom: 4px;
      border-right: 4px solid var(--c-accent);
      padding-right: 8px;
    }

    .section-header-text {
      font-size: 12pt;
      font-weight: bold;
      color: #8c6e26;
    }

    /* ========== ITEMS TABLE ========== */
    .items-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: var(--c-body-size);
      border: 1px solid var(--c-accent);
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 12px;
    }

    .items-table th {
      background: #fdfaf2;
      color: #8c6e26;
      padding: 8px 10px;
      text-align: center;
      font-size: 10pt;
      font-weight: bold;
      border-bottom: 1.5px solid var(--c-accent);
    }

    .items-table td {
      padding: 8px 10px;
      border-bottom: 1px solid ${v.tableBorderColor}50;
      color: ${v.tableTextColor};
    }

    .items-table tbody tr:last-child td {
      border-bottom: none;
    }

    .items-table tbody tr:nth-child(even) {
      background: ${v.tableRowEvenColor};
    }

    .cell-center { text-align: center; }
    .cell-name { font-weight: 500; }
    .cell-bold { font-weight: bold; color: #8c6e26; }

    /* ========== TOTAL BOX ========== */
    .contract-total-box {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      background: #fdfaf2;
      border: 1px solid var(--c-accent);
      color: #8c6e26;
      padding: 8px 16px;
      border-radius: 6px;
      margin-top: 10px;
    }

    .contract-total-box .total-label {
      font-size: 10pt;
      font-weight: bold;
    }

    .contract-total-box .total-value {
      font-size: 14pt;
      font-weight: 800;
    }

    /* ========== CLAUSES ========== */
    .clause-item {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }

    .clause-number {
      min-width: 22px;
      height: 22px;
      background: #fdfaf2;
      color: #8c6e26;
      border: 1px solid var(--c-accent);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9pt;
      font-weight: bold;
      margin-top: 3px;
    }

    .clause-body {
      flex: 1;
    }

    .clause-title {
      font-weight: bold;
      font-size: 11pt;
      color: #8c6e26;
      margin-bottom: 3px;
    }

    .clause-content {
      font-size: var(--c-body-size);
      color: ${v.tableTextColor};
      line-height: 1.8;
      text-align: justify;
    }

    /* ========== DESCRIPTION ========== */
    .description-text {
      font-size: var(--c-body-size);
      color: ${v.tableTextColor};
      line-height: 1.8;
      text-align: justify;
      background: #fdfaf2/10;
      border: 1px solid var(--c-accent);
      padding: 10px 12px;
      border-radius: 6px;
    }

    /* ========== SIGNATURES ========== */
    .signatures-section {
      margin-top: 24px;
      page-break-inside: avoid;
    }

    .signatures-grid {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      margin-top: 10px;
    }

    .signature-box {
      flex: 1;
      text-align: center;
      border: 1px solid var(--c-accent);
      border-radius: 6px;
      overflow: hidden;
      background: #ffffff;
    }

    .sig-header {
      background: #fdfaf2;
      color: #8c6e26;
      border-bottom: 1px solid var(--c-accent);
      padding: 6px 10px;
      font-weight: bold;
      font-size: 10pt;
    }

    .sig-body {
      padding: 15px;
    }

    .sig-name {
      font-size: var(--c-body-size);
      color: ${v.tableTextColor};
      margin-bottom: 35px;
      font-weight: bold;
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

  // Contract info grid (Without amount, and without end date since execution is usually open/without period)
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
        <div class="info-card-label">${pl.label_payment_terms}</div>
        <div class="info-card-value">${contract.payment_terms || "غير محدد"}</div>
      </div>
    </div>
  ` : "";

  const descriptionHtml = cs.contract_show_description && contract.description ? `
    <div class="contract-section">
      <div class="section-header">
        <div class="section-header-text">${pl.description_section}</div>
      </div>
      <div class="description-text">${contract.description}</div>
    </div>
  ` : "";

  // Pricing Table: Agreed prices / rates (No totals mentioned)
  const itemsHtml = cs.contract_show_items_table && items.length > 0 ? `
    <div class="contract-section">
      <div class="section-header">
        <div class="section-header-text">جدول الأسعار المتفق عليه</div>
      </div>
      <table class="items-table">
        <thead>
          <tr>
            <th style="width:10%">${pl.col_number}</th>
            <th>${pl.col_item}</th>
            <th style="width:20%">معامل التكعيب</th>
            <th style="width:25%">${pl.col_unit_price}</th>
          </tr>
        </thead>
        <tbody>
          ${itemsTableRows}
        </tbody>
      </table>
    </div>
  ` : "";

  const clausesSection = cs.contract_show_clauses && clauses.length > 0 ? `
    <div class="contract-section">
      <div class="section-header">
        <div class="section-header-text">${pl.clauses_section}</div>
      </div>
      ${clausesHtml}
    </div>
  ` : "";

  const signeeName = settings?.signee_name || "";
  const signeeTitle = settings?.signee_title || "الممثل القانوني للشركة";

  // First party is ALWAYS the company, second party is ALWAYS the client
  const signaturesHtml = cs.contract_show_signatures ? `
    <div class="signatures-section">
      <div class="section-header">
        <div class="section-header-text">${pl.signatures_section}</div>
      </div>
      <div class="signatures-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 16px;">
        <div class="signature-box" style="border: 1px solid var(--c-accent); border-radius: 8px; background: #ffffff; display: flex; flex-direction: column; height: 165px; overflow: hidden;">
          <div class="sig-header" style="background: #fdfaf2; color: #8c6e26; border-bottom: 1px solid var(--c-accent); padding: 8px 12px; font-weight: bold; font-size: 10pt; text-align: center;">
            الطرف الأول (الشركة)
          </div>
          <div class="sig-body" style="padding: 12px; flex: 1; display: flex; flex-direction: column; justify-content: space-between; text-align: center;">
            <div>
              <div style="font-size: 11pt; font-weight: bold; color: #000; margin-bottom: 4px;">${companyName}</div>
              ${signeeName ? `
              <div style="font-size: 9.5pt; color: #555; font-weight: bold;">
                عنها الممثل: ${signeeName} (${signeeTitle})
              </div>
              ` : `
              <div style="font-size: 9.5pt; color: transparent; select: none;">-</div>
              `}
            </div>
            <div>
              <div style="border-top: 1px dashed var(--c-accent); margin: 0 auto 6px auto; width: 85%;"></div>
              <div style="font-size: 9pt; color: #666; font-weight: bold;">التوقيع والختم</div>
            </div>
          </div>
        </div>

        <div class="signature-box" style="border: 1px solid var(--c-accent); border-radius: 8px; background: #ffffff; display: flex; flex-direction: column; height: 165px; overflow: hidden;">
          <div class="sig-header" style="background: #fdfaf2; color: #8c6e26; border-bottom: 1px solid var(--c-accent); padding: 8px 12px; font-weight: bold; font-size: 10pt; text-align: center;">
            الطرف الثاني (العميل)
          </div>
          <div class="sig-body" style="padding: 12px; flex: 1; display: flex; flex-direction: column; justify-content: space-between; text-align: center;">
            <div>
              <div style="font-size: 11pt; font-weight: bold; color: #000; margin-bottom: 4px;">${clientName || "_______________"}</div>
              <div style="font-size: 9.5pt; color: transparent; select: none;">-</div>
            </div>
            <div>
              <div style="border-top: 1px dashed var(--c-accent); margin: 0 auto 6px auto; width: 85%;"></div>
              <div style="font-size: 9pt; color: #666; font-weight: bold;">التوقيع والختم</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  ` : "";

  // Preamble (التمهيد) is placed first, then Clauses, then the Agreed Pricing/Rates Table, then Signatures
  const content = `
    <div class="print-area">
      <div class="print-content">
        <div class="print-report-title" style="display: none;">رقم العقد: ${contract.contract_number}</div>
        <div class="print-report-subtitle" style="display: none;">تاريخ العقد: ${contract.start_date}</div>
        <div class="contract-title-block">
          <h1 class="contract-main-title">${contract.title}</h1>
        </div>
        ${projectInfoHtml}
        ${descriptionHtml}
        ${clausesSection}
        ${itemsHtml}
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

  openPrintWindow(`رقم العقد: ${contract.contract_number}`, content, settings, contractStyles);
}
