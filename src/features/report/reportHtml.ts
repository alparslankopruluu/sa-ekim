/**
 * HTML for the clinic progress report. Pure: every value arrives already translated and
 * formatted, and every text is escaped here. Images are only ever embedded as base64
 * JPEG/PNG data URIs that pass `isSafeImageDataUri`. The report states facts (photos with
 * week labels, shed counts) and never a conclusion; the disclaimer is always present.
 */

export interface ReportPhoto {
  /** `data:image/jpeg;base64,…` */
  dataUri: string;
  /** "Before" or "Week 3". */
  label: string;
  /** Localized date text. */
  dateText: string;
}

export interface ReportAngleSection {
  title: string;
  /** First and (when there is more than one) latest photo. */
  photos: ReportPhoto[];
}

export interface ReportShedRow {
  weekLabel: string;
  days: string;
  average: string;
  max: string;
}

export interface ReportModel {
  lang: string;
  dir: 'ltr' | 'rtl';
  brand: string;
  title: string;
  clinicLine: string | null;
  operationLine: string | null;
  generatedLine: string;
  photosHeading: string;
  noPhotosText: string;
  sections: ReportAngleSection[];
  shedHeading: string;
  shedColumns: { week: string; days: string; average: string; max: string };
  shedRows: ReportShedRow[];
  shedEmptyText: string;
  disclaimer: string;
}

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ENTITIES[char] ?? char);
}

const DATA_URI = /^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/;

export function isSafeImageDataUri(uri: string): boolean {
  return DATA_URI.test(uri);
}

const LANG = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,2}$/;

const CSS = `
  @page { margin: 18mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #241b14; font-size: 12px; line-height: 1.5; margin: 0; }
  header { border-bottom: 2px solid #c9973f; padding-bottom: 10px; margin-bottom: 18px; }
  .brand { font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #8a6a3a; }
  h1 { font-size: 22px; margin: 4px 0 6px; }
  h2 { font-size: 15px; margin: 22px 0 8px; }
  .meta { color: #5c4a3a; margin: 0; }
  .section { page-break-inside: avoid; margin-bottom: 16px; }
  .section h3 { font-size: 13px; margin: 0 0 6px; }
  .pair { display: flex; gap: 10px; }
  figure { margin: 0; flex: 1; max-width: 48%; }
  figure img { width: 100%; height: auto; border-radius: 6px; display: block; }
  figcaption { font-size: 11px; color: #5c4a3a; margin-top: 4px; }
  table { border-collapse: collapse; width: 100%; page-break-inside: avoid; }
  th, td { border-bottom: 1px solid #e3d6c4; padding: 6px 8px; text-align: start; }
  th { font-size: 11px; color: #5c4a3a; }
  .empty { color: #7a6650; }
  footer { margin-top: 26px; padding-top: 10px; border-top: 1px solid #e3d6c4; font-size: 11px; color: #5c4a3a; }
`;

function figure(photo: ReportPhoto): string {
  const image = isSafeImageDataUri(photo.dataUri) ? `<img src="${photo.dataUri}" alt="" />` : '';
  return `<figure>${image}<figcaption>${escapeHtml(photo.label)} · ${escapeHtml(photo.dateText)}</figcaption></figure>`;
}

function photosBlock(model: ReportModel): string {
  if (model.sections.length === 0) return `<p class="empty">${escapeHtml(model.noPhotosText)}</p>`;
  return model.sections
    .map(
      (section) =>
        `<div class="section"><h3>${escapeHtml(section.title)}</h3><div class="pair">${section.photos.map(figure).join('')}</div></div>`,
    )
    .join('');
}

function shedBlock(model: ReportModel): string {
  if (model.shedRows.length === 0) return `<p class="empty">${escapeHtml(model.shedEmptyText)}</p>`;
  const { week, days, average, max } = model.shedColumns;
  const rows = model.shedRows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.weekLabel)}</td><td>${escapeHtml(row.days)}</td><td>${escapeHtml(row.average)}</td><td>${escapeHtml(row.max)}</td></tr>`,
    )
    .join('');
  return `<table><thead><tr><th>${escapeHtml(week)}</th><th>${escapeHtml(days)}</th><th>${escapeHtml(average)}</th><th>${escapeHtml(max)}</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function buildReportHtml(model: ReportModel): string {
  const lang = LANG.test(model.lang) ? model.lang : 'en';
  const dir = model.dir === 'rtl' ? 'rtl' : 'ltr';
  const meta = [model.clinicLine, model.operationLine, model.generatedLine]
    .filter((line): line is string => !!line)
    .map((line) => `<p class="meta">${escapeHtml(line)}</p>`)
    .join('');
  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(model.title)}</title><style>${CSS}</style></head>
<body>
<header><div class="brand">${escapeHtml(model.brand)}</div><h1>${escapeHtml(model.title)}</h1>${meta}</header>
<h2>${escapeHtml(model.photosHeading)}</h2>
${photosBlock(model)}
<h2>${escapeHtml(model.shedHeading)}</h2>
${shedBlock(model)}
<footer>${escapeHtml(model.disclaimer)}</footer>
</body>
</html>`;
}

export interface CompareSheetModel {
  lang: string;
  dir: 'ltr' | 'rtl';
  brand: string;
  title: string;
  subtitle: string;
  before: ReportPhoto;
  after: ReportPhoto;
  disclaimer: string;
}

/** One-page compare sheet: two photos side by side with their labels and the brand mark. */
export function buildCompareHtml(model: CompareSheetModel): string {
  const lang = LANG.test(model.lang) ? model.lang : 'en';
  const dir = model.dir === 'rtl' ? 'rtl' : 'ltr';
  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(model.title)}</title><style>${CSS}</style></head>
<body>
<header><div class="brand">${escapeHtml(model.brand)}</div><h1>${escapeHtml(model.title)}</h1><p class="meta">${escapeHtml(model.subtitle)}</p></header>
<div class="pair" dir="ltr">${figure(model.before)}${figure(model.after)}</div>
<footer>${escapeHtml(model.disclaimer)}</footer>
</body>
</html>`;
}
