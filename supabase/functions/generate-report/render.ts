// Builds the admin activity report files (PDF and Excel) inside the edge
// function. Pure: takes already-loaded rows, returns file bytes.
//
// Design (2026-10-18): forest header with the logo, summary cards, highlights
// (SOS status, safety events by type, per-child summary), numbered sections
// with coloured status labels. Locations are grouped by child and day in the
// PDF (a week holds thousands of rows); every row is in the Excel file, which
// is styled with ExcelJS (green headers, frozen header rows, filters, real
// date cells).
import {
  PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  rgb,
  StandardFonts,
} from "npm:pdf-lib@1.17.1";
import ExcelJS from "npm:exceljs@4.4.0";
import { decodeBase64 } from "jsr:@std/encoding@1/base64";

import { LOGO_WHITE_PNG_BASE64 } from "./logo.ts";

export type ReportLocation = {
  childName: string;
  source: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  label: string | null;
  recordedAt: string;
  /** Saved street address (location_places), if known. */
  place?: string | null;
  speedMps?: number | null;
  travelMode?: string | null;
};

export type ReportEvent = {
  childName: string;
  eventType: string;
  title: string | null;
  details: string | null;
  anomalyScore: number | null;
  latitude: number | null;
  longitude: number | null;
  occurredAt: string;
  place?: string | null;
};

export type ReportSos = {
  childName: string;
  guardianName: string;
  status: string;
  activationMethod: string | null;
  triggeredAt: string;
  acknowledgedAt: string | null;
  realertCount: number;
  latitude: number | null;
  longitude: number | null;
  place?: string | null;
};

export type ReportData = {
  title: string;
  scopeLabel: string;
  dateFrom: string;
  dateTo: string;
  generatedAt: Date;
  locations: ReportLocation[];
  events: ReportEvent[];
  sos: ReportSos[];
  /** Rows that exist but were left out because of the per-type limit. */
  omitted: { locations: number; events: number; sos: number };
  childrenCovered: number;
};

const DISCLAIMER =
  "SafeTrack reports summarize successfully stored system records. They do not " +
  "independently confirm danger, an emergency, or a child's exact real-time position. " +
  "Locations are the latest positions the devices sent, not a live feed.";

const EVENT_LABELS: Record<string, string> = {
  entry: "Entered safe zone",
  exit: "Left safe zone",
  possible_anomaly: "Unusual movement (AI)",
  watch_disconnected: "Watch disconnected",
  prolonged_inactivity: "Prolonged inactivity",
};

const METHOD_LABELS: Record<string, string> = {
  tap_and_hold: "Tap and hold",
  tap_hold: "Tap and hold",
  manual_button: "Button",
  shake: "Shake",
};

const SOURCE_LABELS: Record<string, string> = {
  smartwatch: "Smartwatch",
  mobile: "Phone",
};

function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function eventLabel(type: string) {
  return EVENT_LABELS[type] ?? titleCase(type);
}

function methodLabel(method: string | null) {
  return method ? METHOD_LABELS[method] ?? titleCase(method) : "";
}

function sourceLabel(source: string | null) {
  return source ? SOURCE_LABELS[source] ?? titleCase(source) : "";
}

const manilaParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function parts(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const all = manilaParts.formatToParts(date);
  const part = (type: string) => all.find((item) => item.type === type)?.value ?? "";
  return { y: part("year"), m: part("month"), d: part("day"), h: part("hour"), min: part("minute") };
}

/** "YYYY-MM-DD HH:mm" in Philippine time, or "" for a missing value. */
export function manilaTime(value: string | Date | null | undefined) {
  if (!value) return "";
  const p = parts(value);
  return p ? `${p.y}-${p.m}-${p.d} ${p.h}:${p.min}` : String(value);
}

/** "YYYY-MM-DD" in Philippine time. */
function manilaDay(value: string) {
  const p = parts(value);
  return p ? `${p.y}-${p.m}-${p.d}` : value.slice(0, 10);
}

/** "HH:mm" in Philippine time. */
function manilaClock(value: string) {
  const p = parts(value);
  return p ? `${p.h}:${p.min}` : "";
}

/** "Oct 12, 2026" from "2026-10-12". */
function longDay(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Excel stores dates without a time zone: shift so the cell shows Philippine time. */
function excelDate(value: string | null) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms + 8 * 3_600_000) : null;
}

function coordinate(value: number | null) {
  return value === null ? "" : value.toFixed(5);
}

function sosStatusCounts(sos: ReportSos[]) {
  const counts = { active: 0, acknowledged: 0, cancelled: 0 };
  for (const alert of sos) {
    if (alert.status in counts) counts[alert.status as keyof typeof counts] += 1;
  }
  return counts;
}

function eventTypeCounts(events: ReportEvent[]) {
  const counts = new Map<string, number>();
  for (const event of events) counts.set(event.eventType, (counts.get(event.eventType) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

type ChildSummary = {
  child: string;
  locations: number;
  events: number;
  sos: number;
  first: string | null;
  last: string | null;
};

function childSummaries(data: ReportData): ChildSummary[] {
  const map = new Map<string, ChildSummary>();
  const get = (child: string) => {
    let row = map.get(child);
    if (!row) {
      row = { child, locations: 0, events: 0, sos: 0, first: null, last: null };
      map.set(child, row);
    }
    return row;
  };
  const seen = (row: ChildSummary, at: string) => {
    if (!row.first || at < row.first) row.first = at;
    if (!row.last || at > row.last) row.last = at;
  };
  for (const l of data.locations) {
    const row = get(l.childName);
    row.locations += 1;
    seen(row, l.recordedAt);
  }
  for (const e of data.events) {
    const row = get(e.childName);
    row.events += 1;
    seen(row, e.occurredAt);
  }
  for (const s of data.sos) {
    const row = get(s.childName);
    row.sos += 1;
    seen(row, s.triggeredAt);
  }
  return [...map.values()].sort((a, b) => a.child.localeCompare(b.child));
}

type EventRow = { at: string; child: string; type: string; count: number; until: string | null; text: string; score: number | null };

/**
 * Newest first, with back-to-back repeats of the same reminder (watch
 * disconnected, prolonged inactivity) for the same child folded into one row:
 * those arrive every hour while a watch stays off and would fill pages.
 */
function groupedEvents(events: ReportEvent[]): EventRow[] {
  const rows: EventRow[] = [];
  const repeatable = new Set(["watch_disconnected", "prolonged_inactivity"]);
  for (const event of [...events].reverse()) {
    const previous = rows[rows.length - 1];
    if (previous && repeatable.has(event.eventType) && previous.type === event.eventType && previous.child === event.childName) {
      previous.count += 1;
      previous.until = event.occurredAt; // older end of the run
      continue;
    }
    rows.push({
      at: event.occurredAt,
      child: event.childName,
      type: event.eventType,
      count: 1,
      until: null,
      text: [event.title, event.details].filter(Boolean).join(": ") || "-",
      score: event.anomalyScore,
    });
  }
  return rows;
}

type DayRow = {
  day: string;
  child: string;
  records: number;
  first: string;
  last: string;
  sources: Set<string>;
  bestAccuracy: number | null;
};

/** Location records grouped by Philippine day and child, oldest first. */
function dailyLocations(locations: ReportLocation[]): DayRow[] {
  const map = new Map<string, DayRow>();
  for (const l of locations) {
    const day = manilaDay(l.recordedAt);
    const key = `${day}|${l.childName}`;
    let row = map.get(key);
    if (!row) {
      row = { day, child: l.childName, records: 0, first: l.recordedAt, last: l.recordedAt, sources: new Set(), bestAccuracy: null };
      map.set(key, row);
    }
    row.records += 1;
    if (l.recordedAt < row.first) row.first = l.recordedAt;
    if (l.recordedAt > row.last) row.last = l.recordedAt;
    if (l.source) row.sources.add(sourceLabel(l.source));
    if (l.accuracyMeters !== null && (row.bestAccuracy === null || l.accuracyMeters < row.bestAccuracy)) {
      row.bestAccuracy = l.accuracyMeters;
    }
  }
  return [...map.values()].sort((a, b) => (a.day === b.day ? a.child.localeCompare(b.child) : a.day.localeCompare(b.day)));
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

const PAGE_WIDTH = 841.89; // A4 landscape
const PAGE_HEIGHT = 595.28;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_SPACE = 30;
const RUNNING_HEADER = 30;

const hex = (value: string) => {
  const n = parseInt(value.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

const COLORS = {
  forest: hex("#0D2A1E"),
  forestSoft: hex("#1E4633"),
  primary: hex("#15803D"),
  accent: hex("#3DDC84"),
  primarySoft: hex("#E7F6EC"),
  ink: hex("#10291C"),
  ink2: hex("#3A4A42"),
  muted: hex("#66766E"),
  border: hex("#DCE8E0"),
  stripe: hex("#F5FAF7"),
  paper: hex("#F4F7F5"),
  white: rgb(1, 1, 1),
  danger: hex("#B42318"),
  dangerSoft: hex("#FDECEA"),
  amber: hex("#B54708"),
  amberSoft: hex("#FEF3E2"),
  violet: hex("#6941C6"),
  violetSoft: hex("#F1ECFD"),
  blue: hex("#175CD3"),
  blueSoft: hex("#E8F0FD"),
  grey: hex("#5D6B66"),
  greySoft: hex("#EEF2F0"),
};

type Color = ReturnType<typeof rgb>;

/** Text colour and pill background for a status or event type. */
function tone(value: string): { fg: Color; bg: Color } {
  switch (value) {
    case "active":
      return { fg: COLORS.danger, bg: COLORS.dangerSoft };
    case "acknowledged":
    case "entry":
      return { fg: COLORS.primary, bg: COLORS.primarySoft };
    case "exit":
      return { fg: COLORS.amber, bg: COLORS.amberSoft };
    case "possible_anomaly":
      return { fg: COLORS.violet, bg: COLORS.violetSoft };
    case "prolonged_inactivity":
      return { fg: COLORS.blue, bg: COLORS.blueSoft };
    default:
      return { fg: COLORS.grey, bg: COLORS.greySoft };
  }
}

type Column = {
  header: string;
  /** Share of the table width. */
  width: number;
  maxLines?: number;
  align?: "left" | "right";
  /** Draw this column's value as a coloured pill; `key` picks the colour. */
  pill?: boolean;
  bold?: boolean;
};

/** A table cell: plain text, or text with a key for its pill colour. */
type CellValue = string | { text: string; key: string };

class PdfWriter {
  readonly doc: PDFDocument;
  readonly font: PDFFont;
  readonly bold: PDFFont;
  page!: PDFPage;
  y = 0;
  private encodable = new Map<string, boolean>();

  constructor(doc: PDFDocument, font: PDFFont, bold: PDFFont) {
    this.doc = doc;
    this.font = font;
    this.bold = bold;
  }

  /** A new page; later pages start below a slim running header. */
  newPage(first = false) {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: COLORS.white });
    this.y = PAGE_HEIGHT - MARGIN - (first ? 0 : RUNNING_HEADER);
  }

  /** Starts a new page unless `height` still fits above the footer. */
  ensure(height: number) {
    if (this.y - height < MARGIN + FOOTER_SPACE) {
      this.newPage();
      return true;
    }
    return false;
  }

  /** Standard PDF fonts only cover WinAnsi; drop anything else (e.g. emoji). */
  clean(text: string) {
    let result = "";
    for (const char of text.replace(/[\r\n\t]+/g, " ")) {
      let ok = this.encodable.get(char);
      if (ok === undefined) {
        try {
          this.font.encodeText(char);
          ok = true;
        } catch {
          ok = false;
        }
        this.encodable.set(char, ok);
      }
      if (ok) result += char;
    }
    return result.replace(/ {2,}/g, " ");
  }

  /** Word-wraps to `width`, ending the last allowed line with "...". */
  wrap(text: string, font: PDFFont, size: number, width: number, maxLines: number) {
    const words = this.clean(text).split(" ").filter(Boolean);
    const lines: string[] = [];
    let line = "";
    const fits = (value: string) => font.widthOfTextAtSize(value, size) <= width;

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (fits(candidate)) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = word;
      while (!fits(line) && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && !fits(line.slice(0, cut))) cut -= 1;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    if (line) lines.push(line);
    if (lines.length <= maxLines) return lines;

    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last && !fits(`${last}...`)) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last}...`;
    return kept;
  }

  draw(value: string, x: number, y: number, size: number, options: { font?: PDFFont; color?: Color } = {}) {
    this.page.drawText(this.clean(value), { x, y, size, font: options.font ?? this.font, color: options.color ?? COLORS.ink });
  }

  width(value: string, size: number, font: PDFFont = this.font) {
    return font.widthOfTextAtSize(this.clean(value), size);
  }

  /** "1  SOS alerts  (18)" with a rule. */
  section(index: number, title: string, count: number | null, subtitle?: string) {
    this.ensure(70);
    this.y -= 18;
    const top = this.y;
    // Number badge.
    this.page.drawCircle({ x: MARGIN + 10, y: top - 9, size: 10, color: COLORS.forest });
    const n = String(index);
    this.draw(n, MARGIN + 10 - this.width(n, 9, this.bold) / 2, top - 12.5, 9, { font: this.bold, color: COLORS.white });
    this.draw(title, MARGIN + 28, top - 14, 14, { font: this.bold, color: COLORS.ink });
    if (count !== null) {
      const label = count.toLocaleString("en-US");
      const x = MARGIN + 28 + this.width(title, 14, this.bold) + 10;
      const w = this.width(label, 8.5, this.bold) + 14;
      this.page.drawRectangle({ x, y: top - 15, width: w, height: 15, color: COLORS.primarySoft, borderColor: COLORS.border, borderWidth: 0.5 });
      this.draw(label, x + 7, top - 11, 8.5, { font: this.bold, color: COLORS.primary });
    }
    this.y -= 22;
    if (subtitle) {
      this.draw(subtitle, MARGIN + 28, this.y - 8, 8.5, { color: COLORS.muted });
      this.y -= 14;
    }
    this.page.drawLine({ start: { x: MARGIN, y: this.y - 2 }, end: { x: MARGIN + CONTENT_WIDTH, y: this.y - 2 }, thickness: 0.75, color: COLORS.border });
    this.y -= 10;
  }

  note(value: string, color: Color = COLORS.muted) {
    const lines = this.wrap(value, this.font, 9, CONTENT_WIDTH, 6);
    this.ensure(lines.length * 12 + 4);
    for (const line of lines) {
      this.draw(line, MARGIN, this.y - 9, 9, { color });
      this.y -= 12;
    }
    this.y -= 4;
  }

  table(columns: Column[], rows: CellValue[][]) {
    const size = 8.5;
    const lineHeight = 11;
    const padX = 6;
    const padY = 6;
    const totalShare = columns.reduce((sum, column) => sum + column.width, 0);
    const widths = columns.map((column) => (column.width / totalShare) * CONTENT_WIDTH);

    const drawHeader = () => {
      const height = lineHeight + padY * 2;
      this.page.drawRectangle({ x: MARGIN, y: this.y - height, width: CONTENT_WIDTH, height, color: COLORS.forest });
      let x = MARGIN;
      columns.forEach((column, index) => {
        const [label] = this.wrap(column.header.toUpperCase(), this.bold, 7.5, widths[index] - padX * 2, 1);
        const w = this.width(label ?? "", 7.5, this.bold);
        const tx = column.align === "right" ? x + widths[index] - padX - w : x + padX;
        this.draw(label ?? "", tx, this.y - padY - 8.5, 7.5, { font: this.bold, color: COLORS.white });
        x += widths[index];
      });
      this.y -= height;
    };

    this.ensure(lineHeight * 3 + padY * 4);
    drawHeader();

    rows.forEach((row, rowIndex) => {
      const texts = row.map((value) => (typeof value === "string" ? value : value.text));
      const cells = texts.map((value, index) =>
        columns[index].pill
          ? [this.clean(value ?? "")]
          : this.wrap(value ?? "", columns[index].bold ? this.bold : this.font, size, widths[index] - padX * 2, columns[index].maxLines ?? 1)
      );
      const lines = Math.max(1, ...cells.map((cell) => cell.length));
      const height = lines * lineHeight + padY * 2;

      if (this.ensure(height)) drawHeader();

      if (rowIndex % 2 === 1) {
        this.page.drawRectangle({ x: MARGIN, y: this.y - height, width: CONTENT_WIDTH, height, color: COLORS.stripe });
      }

      let x = MARGIN;
      cells.forEach((cellLines, index) => {
        const column = columns[index];
        const value = row[index];
        if (column.pill) {
          const text = cellLines[0] ?? "";
          const key = typeof value === "string" ? value : value.key;
          const { fg, bg } = tone(key);
          const w = Math.min(this.width(text, 7.5, this.bold) + 12, widths[index] - padX * 2);
          this.page.drawRectangle({ x: x + padX, y: this.y - padY - 11, width: w, height: 13, color: bg });
          this.draw(text, x + padX + 6, this.y - padY - 7.5, 7.5, { font: this.bold, color: fg });
        } else {
          cellLines.forEach((line, lineIndex) => {
            const font = column.bold ? this.bold : this.font;
            const w = this.width(line, size, font);
            const tx = column.align === "right" ? x + widths[index] - padX - w : x + padX;
            this.draw(line, tx, this.y - padY - size - lineIndex * lineHeight, size, { font, color: column.bold ? COLORS.ink : COLORS.ink2 });
          });
        }
        x += widths[index];
      });

      this.page.drawLine({ start: { x: MARGIN, y: this.y - height }, end: { x: MARGIN + CONTENT_WIDTH, y: this.y - height }, thickness: 0.5, color: COLORS.border });
      this.y -= height;
    });

    this.y -= 8;
  }
}

function drawCover(writer: PdfWriter, data: ReportData, logo: PDFImage) {
  const page = writer.page;
  const bandHeight = 112;
  const top = PAGE_HEIGHT;

  page.drawRectangle({ x: 0, y: top - bandHeight, width: PAGE_WIDTH, height: bandHeight, color: COLORS.forest });
  // Soft circles inside the band (pdf-lib can't clip, so keep them within it).
  page.drawCircle({ x: PAGE_WIDTH - 40, y: top + 6, size: 104, color: COLORS.forestSoft, opacity: 0.55 });
  page.drawCircle({ x: PAGE_WIDTH - 190, y: top - 4, size: 46, color: COLORS.forestSoft, opacity: 0.35 });
  page.drawRectangle({ x: 0, y: top - bandHeight - 4, width: PAGE_WIDTH, height: 4, color: COLORS.accent });

  const logoHeight = 64;
  const logoWidth = (logo.width / logo.height) * logoHeight;
  page.drawImage(logo, { x: MARGIN, y: top - 24 - logoHeight, width: logoWidth, height: logoHeight });

  const textX = MARGIN + logoWidth + 26;
  page.drawLine({ start: { x: textX - 13, y: top - 30 }, end: { x: textX - 13, y: top - 86 }, thickness: 1, color: COLORS.forestSoft });
  writer.draw("ACTIVITY REPORT", textX, top - 42, 8.5, { font: writer.bold, color: COLORS.accent });
  writer.draw(data.title, textX, top - 66, 21, { font: writer.bold, color: COLORS.white });
  writer.draw(
    `${longDay(data.dateFrom)} - ${longDay(data.dateTo)}  ·  ${data.scopeLabel}`,
    textX,
    top - 86,
    10,
    { color: hex("#BFD8C9") },
  );

  const generated = `Generated ${manilaTime(data.generatedAt)} (Philippine time)`;
  writer.draw(generated, PAGE_WIDTH - MARGIN - writer.width(generated, 8), top - 42, 8, { color: hex("#BFD8C9") });

  writer.y = top - bandHeight - 4 - 20;
}

function drawCards(writer: PdfWriter, data: ReportData) {
  const counts = sosStatusCounts(data.sos);
  const days = new Set(data.locations.map((l) => manilaDay(l.recordedAt))).size;
  const cards: Array<{ label: string; value: string; sub: string; accent: Color; danger?: boolean }> = [
    {
      label: "SOS alerts",
      value: data.sos.length.toLocaleString("en-US"),
      sub: counts.active ? `${counts.active} still active` : data.sos.length ? "All handled" : "None in this period",
      accent: counts.active ? COLORS.danger : COLORS.primary,
      danger: counts.active > 0,
    },
    {
      label: "Safety events",
      value: data.events.length.toLocaleString("en-US"),
      sub: "Safe zones, AI, device",
      accent: COLORS.amber,
    },
    {
      label: "Location records",
      value: data.locations.length.toLocaleString("en-US"),
      sub: `${days} day${days === 1 ? "" : "s"} with records`,
      accent: COLORS.blue,
    },
    {
      label: "Children covered",
      value: data.childrenCovered.toLocaleString("en-US"),
      sub: data.scopeLabel,
      accent: COLORS.violet,
    },
  ];

  const gap = 12;
  const w = (CONTENT_WIDTH - gap * (cards.length - 1)) / cards.length;
  const h = 70;
  writer.ensure(h + 10);

  cards.forEach((card, index) => {
    const x = MARGIN + index * (w + gap);
    const y = writer.y - h;
    writer.page.drawRectangle({ x, y, width: w, height: h, color: card.danger ? COLORS.dangerSoft : COLORS.paper, borderColor: COLORS.border, borderWidth: 0.75 });
    writer.page.drawRectangle({ x, y, width: 4, height: h, color: card.accent });
    writer.draw(card.label.toUpperCase(), x + 16, writer.y - 18, 7.5, { font: writer.bold, color: COLORS.muted });
    writer.draw(card.value, x + 16, writer.y - 46, 24, { font: writer.bold, color: card.danger ? COLORS.danger : COLORS.ink });
    writer.draw(card.sub, x + 16, writer.y - 61, 8, { color: COLORS.muted });
  });

  writer.y -= h + 14;
}

function drawHighlights(writer: PdfWriter, data: ReportData) {
  const counts = sosStatusCounts(data.sos);
  const types = eventTypeCounts(data.events);
  const gap = 14;
  const w = (CONTENT_WIDTH - gap) / 2;
  const rows = Math.max(3, Math.min(types.length, 5));
  const h = 46 + rows * 17;
  writer.ensure(h + 10);
  const top = writer.y;

  // SOS status: stacked bar and legend.
  const x1 = MARGIN;
  writer.page.drawRectangle({ x: x1, y: top - h, width: w, height: h, color: COLORS.white, borderColor: COLORS.border, borderWidth: 0.75 });
  writer.draw("SOS STATUS", x1 + 14, top - 20, 8, { font: writer.bold, color: COLORS.muted });
  const barX = x1 + 14;
  const barW = w - 28;
  const barY = top - 44;
  const total = Math.max(1, data.sos.length);
  writer.page.drawRectangle({ x: barX, y: barY, width: barW, height: 12, color: COLORS.greySoft });
  let cursor = barX;
  const parts: Array<[string, number, Color]> = [
    ["Active", counts.active, COLORS.danger],
    ["Acknowledged", counts.acknowledged, COLORS.primary],
    ["Cancelled", counts.cancelled, COLORS.grey],
  ];
  for (const [, value, color] of parts) {
    if (!value) continue;
    const segment = (value / total) * barW;
    writer.page.drawRectangle({ x: cursor, y: barY, width: segment, height: 12, color });
    cursor += segment;
  }
  parts.forEach(([label, value, color], index) => {
    const ly = barY - 20 - index * 17;
    writer.page.drawRectangle({ x: barX, y: ly, width: 9, height: 9, color });
    writer.draw(label, barX + 16, ly + 1, 9, { color: COLORS.ink2 });
    const text = value.toLocaleString("en-US");
    writer.draw(text, barX + barW - writer.width(text, 9, writer.bold), ly + 1, 9, { font: writer.bold, color: COLORS.ink });
  });
  if (data.sos.length === 0) writer.draw("No SOS alerts in this period.", barX, barY + 18, 8, { color: COLORS.muted });

  // Safety events by type: horizontal bars.
  const x2 = MARGIN + w + gap;
  writer.page.drawRectangle({ x: x2, y: top - h, width: w, height: h, color: COLORS.white, borderColor: COLORS.border, borderWidth: 0.75 });
  writer.draw("SAFETY EVENTS BY TYPE", x2 + 14, top - 20, 8, { font: writer.bold, color: COLORS.muted });
  if (types.length === 0) {
    writer.draw("No safety events in this period.", x2 + 14, top - 44, 9, { color: COLORS.muted });
  } else {
    const max = Math.max(...types.map(([, value]) => value));
    const labelW = 120;
    const valueW = 36;
    const trackW = w - 28 - labelW - valueW;
    types.slice(0, 5).forEach(([type, value], index) => {
      const ly = top - 42 - index * 17;
      const { fg } = tone(type);
      writer.draw(eventLabel(type), x2 + 14, ly, 8.5, { color: COLORS.ink2 });
      writer.page.drawRectangle({ x: x2 + 14 + labelW, y: ly - 1, width: trackW, height: 9, color: COLORS.greySoft });
      writer.page.drawRectangle({ x: x2 + 14 + labelW, y: ly - 1, width: Math.max(3, (value / max) * trackW), height: 9, color: fg });
      const text = value.toLocaleString("en-US");
      writer.draw(text, x2 + w - 14 - writer.width(text, 8.5, writer.bold), ly, 8.5, { font: writer.bold, color: COLORS.ink });
    });
  }

  writer.y = top - h - 8;

  const omitted = Object.entries(data.omitted).filter(([, count]) => count > 0);
  if (omitted.length > 0) {
    writer.y -= 4;
    writer.note(
      "This report is limited per record type; not included: " +
        omitted.map(([type, count]) => `${count.toLocaleString("en-US")} ${type}`).join(", ") +
        ". Choose a shorter period or a single child for a complete report.",
      COLORS.danger,
    );
  }
}

function drawRunningHeaders(doc: PDFDocument, writer: PdfWriter, data: ReportData) {
  const pages = doc.getPages();
  pages.forEach((page, index) => {
    if (index > 0) {
      page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 26, width: PAGE_WIDTH, height: 26, color: COLORS.forest });
      page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 28, width: PAGE_WIDTH, height: 2, color: COLORS.accent });
      page.drawText("SAFETRACK", { x: MARGIN, y: PAGE_HEIGHT - 17, size: 8, font: writer.bold, color: COLORS.accent });
      page.drawText(writer.clean(`${data.title}  ·  ${longDay(data.dateFrom)} - ${longDay(data.dateTo)}`), {
        x: MARGIN + 62,
        y: PAGE_HEIGHT - 17,
        size: 8,
        font: writer.font,
        color: hex("#BFD8C9"),
      });
    }

    const label = `SafeTrack  ·  Activity report  ·  ${data.scopeLabel}`;
    const pageLabel = `Page ${index + 1} of ${pages.length}`;
    page.drawLine({ start: { x: MARGIN, y: MARGIN + 12 }, end: { x: PAGE_WIDTH - MARGIN, y: MARGIN + 12 }, thickness: 0.5, color: COLORS.border });
    page.drawText(writer.clean(label), { x: MARGIN, y: MARGIN, size: 8, font: writer.font, color: COLORS.muted });
    page.drawText(pageLabel, {
      x: PAGE_WIDTH - MARGIN - writer.font.widthOfTextAtSize(pageLabel, 8),
      y: MARGIN,
      size: 8,
      font: writer.bold,
      color: COLORS.muted,
    });
  });
}

function drawAbout(writer: PdfWriter) {
  writer.ensure(70);
  writer.y -= 6;
  const boxTop = writer.y;
  const lines = writer.wrap(DISCLAIMER, writer.font, 9, CONTENT_WIDTH - 28, 5);
  const boxH = 28 + lines.length * 12;
  writer.page.drawRectangle({ x: MARGIN, y: boxTop - boxH, width: CONTENT_WIDTH, height: boxH, color: COLORS.primarySoft, borderColor: COLORS.border, borderWidth: 0.75 });
  writer.draw("ABOUT THIS REPORT", MARGIN + 14, boxTop - 16, 7.5, { font: writer.bold, color: COLORS.primary });
  lines.forEach((line, index) => writer.draw(line, MARGIN + 14, boxTop - 30 - index * 12, 9, { color: COLORS.ink2 }));
  writer.y = boxTop - boxH - 8;
}

export async function buildPdfReport(data: ReportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(decodeBase64(LOGO_WHITE_PNG_BASE64));

  doc.setTitle(data.title);
  doc.setAuthor("SafeTrack");
  doc.setSubject(`Activity report ${data.dateFrom} to ${data.dateTo}`);
  doc.setCreationDate(data.generatedAt);

  const writer = new PdfWriter(doc, font, bold);
  writer.newPage(true);

  drawCover(writer, data, logo);
  drawCards(writer, data);
  drawHighlights(writer, data);

  // Per child.
  const children = childSummaries(data);
  writer.section(1, "Children in this report", children.length);
  writer.table(
    [
      { header: "Child", width: 22, bold: true },
      { header: "Location records", width: 13, align: "right" },
      { header: "Safety events", width: 12, align: "right" },
      { header: "SOS alerts", width: 11, align: "right" },
      { header: "First record (PHT)", width: 21 },
      { header: "Latest record (PHT)", width: 21 },
    ],
    children.map((row) => [
      row.child,
      row.locations.toLocaleString("en-US"),
      row.events.toLocaleString("en-US"),
      row.sos.toLocaleString("en-US"),
      manilaTime(row.first),
      manilaTime(row.last),
    ]),
  );

  drawAbout(writer);

  // SOS alerts.
  writer.section(2, "SOS alerts", data.sos.length, "Newest first. Re-alerts are reminders sent while an SOS stayed active.");
  if (data.sos.length === 0) {
    writer.note("No SOS alerts in this period.");
  } else {
    writer.table(
      [
        { header: "Triggered (PHT)", width: 14 },
        { header: "Child", width: 13, bold: true },
        { header: "Guardian", width: 13 },
        { header: "Method", width: 11 },
        { header: "Status", width: 12, pill: true },
        { header: "Acknowledged (PHT)", width: 14 },
        { header: "Re-alerts", width: 8, align: "right" },
        { header: "Location", width: 15 },
      ],
      [...data.sos].reverse().map((alert) => [
        manilaTime(alert.triggeredAt),
        alert.childName,
        alert.guardianName,
        methodLabel(alert.activationMethod),
        { text: titleCase(alert.status), key: alert.status },
        manilaTime(alert.acknowledgedAt) || "-",
        String(alert.realertCount),
        alert.place ?? (alert.latitude === null ? "-" : `${coordinate(alert.latitude)}, ${coordinate(alert.longitude)}`),
      ]),
    );
  }

  // Safety events.
  writer.section(
    3,
    "Safe-zone and safety events",
    data.events.length,
    "Newest first. Repeated reminders are folded into one row (each is listed in Excel). AI notices are advisory only.",
  );
  if (data.events.length === 0) {
    writer.note("No safe-zone or safety events in this period.");
  } else {
    writer.table(
      [
        { header: "Occurred (PHT)", width: 15, maxLines: 2 },
        { header: "Child", width: 11, bold: true },
        { header: "Event", width: 19, pill: true },
        { header: "Details", width: 47, maxLines: 2 },
        { header: "AI score", width: 8, align: "right" },
      ],
      groupedEvents(data.events).map((row) => [
        // A folded run shows its time span: oldest to newest.
        row.until ? `${manilaTime(row.until)} to ${manilaDay(row.until) === manilaDay(row.at) ? manilaClock(row.at) : manilaTime(row.at)}` : manilaTime(row.at),
        row.child,
        { text: row.count > 1 ? `${eventLabel(row.type)} x${row.count}` : eventLabel(row.type), key: row.type },
        row.count > 1 ? `${row.count} reminders while it continued. ${row.text}` : row.text,
        row.score === null ? "" : row.score.toFixed(2),
      ]),
    );
  }

  // Locations by day.
  const days = dailyLocations(data.locations);
  writer.section(
    4,
    "Location records by day",
    data.locations.length,
    "Grouped by child and Philippine day. Every single record, with coordinates, is in the Excel export.",
  );
  if (days.length === 0) {
    writer.note("No location records in this period.");
  } else {
    writer.table(
      [
        { header: "Day", width: 16, bold: true },
        { header: "Child", width: 18 },
        { header: "Records", width: 10, align: "right" },
        { header: "First (PHT)", width: 12 },
        { header: "Latest (PHT)", width: 12 },
        { header: "Sources", width: 18 },
        { header: "Best accuracy", width: 14, align: "right" },
      ],
      days.map((row) => [
        longDay(row.day),
        row.child,
        row.records.toLocaleString("en-US"),
        manilaClock(row.first),
        manilaClock(row.last),
        [...row.sources].join(", ") || "-",
        row.bestAccuracy === null ? "-" : `±${row.bestAccuracy.toFixed(0)} m`,
      ]),
    );
  }

  drawRunningHeaders(doc, writer, data);
  return await doc.save();
}

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------

const X = {
  forest: "FF0D2A1E",
  primary: "FF15803D",
  accent: "FF3DDC84",
  soft: "FFE7F6EC",
  stripe: "FFF5FAF7",
  border: "FFDCE8E0",
  muted: "FF66766E",
  white: "FFFFFFFF",
  danger: "FFB42318",
  amber: "FFB54708",
  violet: "FF6941C6",
  blue: "FF175CD3",
  grey: "FF5D6B66",
};

const XTONE: Record<string, string> = {
  active: X.danger,
  acknowledged: X.primary,
  cancelled: X.grey,
  entry: X.primary,
  exit: X.amber,
  possible_anomaly: X.violet,
  watch_disconnected: X.grey,
  prolonged_inactivity: X.blue,
};

const DATE_FORMAT = "yyyy-mm-dd hh:mm";
const thin = { style: "thin" as const, color: { argb: X.border } };

type XColumn = { header: string; key: string; width: number; numFmt?: string; align?: "left" | "right" | "center" };

/** A styled data sheet: forest header row, frozen, filter, zebra rows. */
function dataSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  title: string,
  columns: XColumn[],
  rows: Record<string, unknown>[],
  colour?: { key: string; toneKey: (row: Record<string, unknown>) => string },
) {
  const ws = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 3 }],
    properties: { tabColor: { argb: X.primary } },
  });
  ws.columns = columns.map((c) => ({ key: c.key, width: c.width }));

  // Title row.
  ws.mergeCells(1, 1, 1, columns.length);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14, color: { argb: X.white } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: X.forest } };
  titleCell.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(1).height = 28;
  ws.getRow(2).height = 6;

  const header = ws.getRow(3);
  columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: X.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: X.primary } };
    cell.alignment = { vertical: "middle", horizontal: c.align ?? "left", wrapText: true };
    cell.border = { bottom: thin };
  });
  header.height = 22;

  rows.forEach((data, index) => {
    const row = ws.addRow(data);
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const c = columns[col - 1];
      if (!c) return;
      if (c.numFmt) cell.numFmt = c.numFmt;
      cell.alignment = { vertical: "top", horizontal: c.align ?? "left", wrapText: c.width >= 40 };
      cell.border = { bottom: thin };
      if (index % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: X.stripe } };
    });
    if (colour) {
      const tint = XTONE[colour.toneKey(data)];
      if (tint) row.getCell(colour.key).font = { bold: true, color: { argb: tint } };
    }
  });

  if (rows.length > 0) {
    ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + rows.length, column: columns.length } };
  } else {
    const empty = ws.addRow([]);
    empty.getCell(1).value = "No records in this period.";
    empty.getCell(1).font = { italic: true, color: { argb: X.muted } };
  }
  return ws;
}

export async function buildExcelReport(data: ReportData): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SafeTrack";
  workbook.created = data.generatedAt;
  workbook.title = data.title;

  const counts = sosStatusCounts(data.sos);
  const period = `${longDay(data.dateFrom)} - ${longDay(data.dateTo)}`;

  // --- Summary -------------------------------------------------------------
  const ws = workbook.addWorksheet("Summary", { properties: { tabColor: { argb: X.forest } }, views: [{ showGridLines: false }] });
  ws.columns = [{ width: 3 }, { width: 34 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 22 }, { width: 22 }];

  ws.mergeCells("B2:G2");
  const t = ws.getCell("B2");
  t.value = "SAFETRACK  ·  ACTIVITY REPORT";
  t.font = { bold: true, size: 9, color: { argb: X.accent } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: X.forest } };
  t.alignment = { indent: 1, vertical: "bottom" };
  ws.mergeCells("B3:G3");
  const t2 = ws.getCell("B3");
  t2.value = data.title;
  t2.font = { bold: true, size: 20, color: { argb: X.white } };
  t2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: X.forest } };
  t2.alignment = { indent: 1, vertical: "middle" };
  ws.getRow(3).height = 34;
  ws.mergeCells("B4:G4");
  const t3 = ws.getCell("B4");
  t3.value = `${period}  ·  ${data.scopeLabel}  ·  Generated ${manilaTime(data.generatedAt)} (Philippine time)`;
  t3.font = { size: 10, color: { argb: "FFBFD8C9" } };
  t3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: X.forest } };
  t3.alignment = { indent: 1, vertical: "top" };
  ws.getRow(4).height = 22;
  for (let c = 2; c <= 7; c += 1) ws.getCell(5, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: X.accent } };
  ws.getRow(5).height = 4;

  // Key figures.
  const figures: Array<[string, number, string, string]> = [
    ["SOS alerts", data.sos.length, counts.active ? `${counts.active} still active` : data.sos.length ? "All handled" : "None", counts.active ? X.danger : X.primary],
    ["Safety events", data.events.length, "Safe zones, AI, device", X.amber],
    ["Location records", data.locations.length, `${new Set(data.locations.map((l) => manilaDay(l.recordedAt))).size} days with records`, X.blue],
    ["Children covered", data.childrenCovered, data.scopeLabel, X.violet],
  ];
  ws.getCell("B7").value = "KEY FIGURES";
  ws.getCell("B7").font = { bold: true, size: 9, color: { argb: X.muted } };
  figures.forEach(([label, value, sub, colour], i) => {
    const r = 8 + i;
    const l = ws.getCell(r, 2);
    l.value = label;
    l.font = { bold: true };
    l.border = { left: { style: "thick", color: { argb: colour } }, bottom: thin };
    const v = ws.getCell(r, 3);
    v.value = value;
    v.font = { bold: true, size: 14, color: { argb: colour === X.danger ? X.danger : "FF10291C" } };
    v.alignment = { horizontal: "right" };
    v.border = { bottom: thin };
    ws.mergeCells(r, 4, r, 7);
    const s = ws.getCell(r, 4);
    s.value = sub;
    s.font = { color: { argb: X.muted } };
    s.border = { bottom: thin };
    ws.getRow(r).height = 22;
  });

  // SOS status and events by type, side by side.
  const head = (cell: ExcelJS.Cell, value: string) => {
    cell.value = value;
    cell.font = { bold: true, color: { argb: X.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: X.primary } };
  };
  head(ws.getCell("B14"), "SOS status");
  head(ws.getCell("C14"), "Alerts");
  ([["Active", counts.active, X.danger], ["Acknowledged", counts.acknowledged, X.primary], ["Cancelled", counts.cancelled, X.grey]] as const).forEach(
    ([label, value, colour], i) => {
      const a = ws.getCell(15 + i, 2);
      a.value = label;
      a.font = { bold: true, color: { argb: colour } };
      a.border = { bottom: thin };
      const b = ws.getCell(15 + i, 3);
      b.value = value;
      b.border = { bottom: thin };
    },
  );
  head(ws.getCell("E14"), "Safety event type");
  ws.mergeCells("E14:F14");
  head(ws.getCell("G14"), "Events");
  eventTypeCounts(data.events).forEach(([type, value], i) => {
    ws.mergeCells(15 + i, 5, 15 + i, 6);
    const a = ws.getCell(15 + i, 5);
    a.value = eventLabel(type);
    a.font = { bold: true, color: { argb: XTONE[type] ?? X.grey } };
    a.border = { bottom: thin };
    const b = ws.getCell(15 + i, 7);
    b.value = value;
    b.border = { bottom: thin };
  });

  // Children.
  const children = childSummaries(data);
  const cStart = 22;
  ["Child", "Location records", "Safety events", "SOS alerts", "First record (PHT)", "Latest record (PHT)"].forEach((label, i) =>
    head(ws.getCell(cStart, 2 + i), label)
  );
  children.forEach((row, i) => {
    const r = cStart + 1 + i;
    const values = [row.child, row.locations, row.events, row.sos, excelDate(row.first), excelDate(row.last)];
    values.forEach((value, c) => {
      const cell = ws.getCell(r, 2 + c);
      cell.value = value as ExcelJS.CellValue;
      cell.border = { bottom: thin };
      if (c >= 4) cell.numFmt = DATE_FORMAT;
      if (c === 0) cell.font = { bold: true };
      if (i % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: X.stripe } };
    });
  });

  // Notes.
  let r = cStart + children.length + 3;
  const omitted = Object.entries(data.omitted).filter(([, count]) => count > 0);
  if (omitted.length > 0) {
    ws.mergeCells(r, 2, r, 7);
    const o = ws.getCell(r, 2);
    o.value =
      "Not included (limit reached): " +
      omitted.map(([type, count]) => `${count.toLocaleString("en-US")} ${type}`).join(", ") +
      ". Choose a shorter period or a single child for a complete report.";
    o.font = { bold: true, color: { argb: X.danger } };
    o.alignment = { wrapText: true };
    ws.getRow(r).height = 30;
    r += 2;
  }
  ws.mergeCells(r, 2, r + 2, 7);
  const n = ws.getCell(r, 2);
  n.value = `About this report: ${DISCLAIMER}`;
  n.font = { color: { argb: X.muted }, size: 10 };
  n.alignment = { wrapText: true, vertical: "top" };
  n.fill = { type: "pattern", pattern: "solid", fgColor: { argb: X.soft } };

  // --- Daily activity ------------------------------------------------------
  dataSheet(
    workbook,
    "Daily activity",
    `Location records by day  ·  ${period}`,
    [
      { header: "Day", key: "day", width: 14 },
      { header: "Child", key: "child", width: 24 },
      { header: "Records", key: "records", width: 11, align: "right" },
      { header: "First (PHT)", key: "first", width: 18, numFmt: DATE_FORMAT },
      { header: "Latest (PHT)", key: "last", width: 18, numFmt: DATE_FORMAT },
      { header: "Sources", key: "sources", width: 20 },
      { header: "Best accuracy (m)", key: "accuracy", width: 17, align: "right", numFmt: "0" },
    ],
    dailyLocations(data.locations).map((row) => ({
      day: row.day,
      child: row.child,
      records: row.records,
      first: excelDate(row.first),
      last: excelDate(row.last),
      sources: [...row.sources].join(", "),
      accuracy: row.bestAccuracy,
    })),
  );

  // --- SOS -----------------------------------------------------------------
  dataSheet(
    workbook,
    "SOS alerts",
    `SOS alerts  ·  ${period}`,
    [
      { header: "Triggered (PHT)", key: "triggered", width: 18, numFmt: DATE_FORMAT },
      { header: "Child", key: "child", width: 22 },
      { header: "Guardian", key: "guardian", width: 22 },
      { header: "Method", key: "method", width: 14 },
      { header: "Status", key: "status", width: 14 },
      { header: "Acknowledged (PHT)", key: "acknowledged", width: 20, numFmt: DATE_FORMAT },
      { header: "Re-alerts", key: "realerts", width: 10, align: "right" },
      { header: "Latitude", key: "lat", width: 12, numFmt: "0.00000" },
      { header: "Longitude", key: "lng", width: 12, numFmt: "0.00000" },
      { header: "Address (OpenStreetMap)", key: "place", width: 48 },
    ],
    [...data.sos].reverse().map((alert) => ({
      triggered: excelDate(alert.triggeredAt),
      child: alert.childName,
      guardian: alert.guardianName,
      method: methodLabel(alert.activationMethod),
      status: titleCase(alert.status),
      acknowledged: excelDate(alert.acknowledgedAt),
      realerts: alert.realertCount,
      lat: alert.latitude,
      lng: alert.longitude,
      place: alert.place ?? "",
      _tone: alert.status,
    })),
    { key: "status", toneKey: (row) => String(row._tone ?? "") },
  );

  // --- Events --------------------------------------------------------------
  dataSheet(
    workbook,
    "Safety events",
    `Safe-zone and safety events  ·  ${period}`,
    [
      { header: "Occurred (PHT)", key: "occurred", width: 18, numFmt: DATE_FORMAT },
      { header: "Child", key: "child", width: 22 },
      { header: "Event", key: "event", width: 24 },
      { header: "Title", key: "title", width: 30 },
      { header: "Details", key: "details", width: 60 },
      { header: "AI score", key: "score", width: 10, align: "right", numFmt: "0.00" },
      { header: "Latitude", key: "lat", width: 12, numFmt: "0.00000" },
      { header: "Longitude", key: "lng", width: 12, numFmt: "0.00000" },
      { header: "Address (OpenStreetMap)", key: "place", width: 48 },
    ],
    [...data.events].reverse().map((event) => ({
      occurred: excelDate(event.occurredAt),
      child: event.childName,
      event: eventLabel(event.eventType),
      title: event.title ?? "",
      details: event.details ?? "",
      score: event.anomalyScore,
      lat: event.latitude,
      lng: event.longitude,
      place: event.place ?? "",
      _tone: event.eventType,
    })),
    { key: "event", toneKey: (row) => String(row._tone ?? "") },
  );

  // --- Locations -----------------------------------------------------------
  dataSheet(
    workbook,
    "Location records",
    `All location records  ·  ${period}`,
    [
      { header: "Recorded (PHT)", key: "recorded", width: 18, numFmt: DATE_FORMAT },
      { header: "Child", key: "child", width: 22 },
      { header: "Source", key: "source", width: 12 },
      { header: "Latitude", key: "lat", width: 12, numFmt: "0.00000" },
      { header: "Longitude", key: "lng", width: 12, numFmt: "0.00000" },
      { header: "Accuracy (m)", key: "accuracy", width: 13, align: "right", numFmt: "0" },
      { header: "Label", key: "label", width: 36 },
      { header: "Travel mode", key: "mode", width: 14 },
      { header: "Speed (km/h)", key: "speed", width: 12, align: "right", numFmt: "0" },
      { header: "Address (OpenStreetMap)", key: "place", width: 48 },
    ],
    data.locations.map((location) => ({
      recorded: excelDate(location.recordedAt),
      child: location.childName,
      source: sourceLabel(location.source),
      lat: location.latitude,
      lng: location.longitude,
      accuracy: location.accuracyMeters,
      label: location.label ?? "",
      mode: location.travelMode ? titleCase(location.travelMode) : "",
      speed: location.speedMps != null ? location.speedMps * 3.6 : null,
      place: location.place ?? "",
    })),
  );

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
