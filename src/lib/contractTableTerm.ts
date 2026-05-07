import { PageSectionSettings } from '@/hooks/useContractTemplateSettings';

type TableTermSettings = NonNullable<PageSectionSettings['tableTerm']>;

interface BuildTableTermOptions {
  tableTerm: TableTermSettings;
  title: string;
  content: string;
}

export interface BuiltTableTermResult {
  html: string;
  height: number;
}

export function buildTableTermHtml({ tableTerm, title, content }: BuildTableTermOptions): BuiltTableTermResult {
  const fontSize = tableTerm.fontSize || 14;
  const titleWeight = tableTerm.titleFontWeight || 'bold';
  const contentWeight = tableTerm.contentFontWeight || 'normal';
  const textColor = tableTerm.color || '#1a1a2e';
  const termWrapHeight = Math.max(fontSize * 2, 32);
  const goldHeightPct = tableTerm.goldLine?.heightPercent || 30;
  const goldColor = tableTerm.goldLine?.color || '#D4AF37';
  const showGold = tableTerm.goldLine?.visible !== false;

  const goldLineHtml = showGold
    ? `<span style="
        position: absolute;
        left: 0; right: 0;
        top: 50%;
        transform: translateY(-50%);
        height: ${goldHeightPct}%;
        background-color: ${goldColor};
        border-radius: 2px;
        z-index: 0;
      "></span>`
    : '';

  return {
    height: termWrapHeight,
    html: `
      <div style="
        text-align: center;
        font-family: 'Doran', sans-serif;
        direction: rtl;
        margin: 0; padding: 0;
      ">
        <h2 style="
          font-size: ${fontSize}px;
          color: ${textColor};
          margin: 0;
          display: inline-block;
        ">
          <span style="
            font-weight: ${titleWeight};
            position: relative;
            display: inline-block;
          ">
            ${goldLineHtml}
            <span style="position: relative; z-index: 1;">${title}</span>
          </span>
          <span style="font-weight: ${contentWeight};"> ${content}</span>
        </h2>
      </div>
    `,
  };
}
