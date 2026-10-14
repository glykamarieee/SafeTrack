// Builds the admin activity report files (PDF and Excel) inside the edge
// function. Pure: takes already-loaded rows, returns file bytes.
import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  rgb,
  StandardFonts,
} from "npm:pdf-lib@1.17.1";
// Supabase's bundler only accepts npm:/jsr: imports, not other CDNs. The npm
// release's known advisories affect reading files; this only writes them.
import * as XLSX from "npm:xlsx@0.18.5";

export type ReportLocation = {
  childName: string;
  source: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  label: string | null;
  recordedAt: string;
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
  "independently confirm danger, an emergency, or a child's exact real-time position.";

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

/** "YYYY-MM-DD HH:mm" in Philippine time, or "" for a missing value. */
export function manilaTime(value: string | Date | null | undefined) {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);

  if (!Number.isFinite(date.getTime())) return String(value);

  const part = (type: string) =>
    manilaParts.formatToParts(date).find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}`;
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

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

const PAGE_WIDTH = 841.89; // A4 landscape
const PAGE_HEIGHT = 595.28;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_SPACE = 28;

const COLORS = {
  primary: rgb(0.067, 0.455, 0.278), // #117447
  primarySoft: rgb(0.918, 0.973, 0.941),
  ink: rgb(0.063, 0.161, 0.11),
  muted: rgb(0.4, 0.463, 0.431),
  border: rgb(0.863, 0.918, 0.882),
  stripe: rgb(0.969, 0.984, 0.973),
  danger: rgb(0.737, 0.169, 0.2),
  white: rgb(1, 1, 1),
};

type Column = {
  header: string;
  /** Share of the table width. */
  width: number;
  maxLines?: number;
};

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
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
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

      // A single word wider than the column is cut to fit.
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

  text(
    value: string,
    options: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; x?: number } = {},
  ) {
    const size = options.size ?? 10;

    this.page.drawText(this.clean(value), {
      x: options.x ?? MARGIN,
      y: this.y - size,
      size,
      font: options.font ?? this.font,
      color: options.color ?? COLORS.ink,
    });
  }

  heading(value: string, count: number) {
    this.ensure(60);
    this.y -= 14;
    this.text(`${value} (${count.toLocaleString("en-US")})`, {
      size: 13,
      font: this.bold,
      color: COLORS.primary,
    });
    this.y -= 22;
  }

  note(value: string) {
    const lines = this.wrap(value, this.font, 9, CONTENT_WIDTH, 6);
    this.ensure(lines.length * 12 + 4);

    for (const line of lines) {
      this.text(line, { size: 9, color: COLORS.muted });
      this.y -= 12;
    }

    this.y -= 4;
  }

  table(columns: Column[], rows: string[][]) {
    const size = 8.5;
    const lineHeight = 11;
    const padX = 5;
    const padY = 5;
    const totalShare = columns.reduce((sum, column) => sum + column.width, 0);
    const widths = columns.map((column) => (column.width / totalShare) * CONTENT_WIDTH);

    const drawHeader = () => {
      const height = lineHeight + padY * 2;

      this.page.drawRectangle({
        x: MARGIN,
        y: this.y - height,
        width: CONTENT_WIDTH,
        height,
        color: COLORS.primary,
      });

      let x = MARGIN;

      columns.forEach((column, index) => {
        const [label] = this.wrap(column.header, this.bold, size, widths[index] - padX * 2, 1);

        this.page.drawText(label ?? "", {
          x: x + padX,
          y: this.y - padY - size,
          size,
          font: this.bold,
          color: COLORS.white,
        });
        x += widths[index];
      });

      this.y -= height;
    };

    this.ensure(lineHeight * 3 + padY * 4);
    drawHeader();

    rows.forEach((row, rowIndex) => {
      const cells = row.map((value, index) =>
        this.wrap(value ?? "", this.font, size, widths[index] - padX * 2, columns[index].maxLines ?? 1)
      );
      const lines = Math.max(1, ...cells.map((cell) => cell.length));
      const height = lines * lineHeight + padY * 2;

      if (this.ensure(height)) drawHeader();

      if (rowIndex % 2 === 1) {
        this.page.drawRectangle({
          x: MARGIN,
          y: this.y - height,
          width: CONTENT_WIDTH,
          height,
          color: COLORS.stripe,
        });
      }

      let x = MARGIN;

      cells.forEach((cellLines, index) => {
        cellLines.forEach((line, lineIndex) => {
          this.page.drawText(line, {
            x: x + padX,
            y: this.y - padY - size - lineIndex * lineHeight,
            size,
            font: this.font,
            color: COLORS.ink,
          });
        });
        x += widths[index];
      });

      this.page.drawLine({
        start: { x: MARGIN, y: this.y - height },
        end: { x: MARGIN + CONTENT_WIDTH, y: this.y - height },
        thickness: 0.5,
        color: COLORS.border,
      });

      this.y -= height;
    });

    this.y -= 6;
  }
}

function drawSummary(writer: PdfWriter, data: ReportData) {
  const sosCounts = sosStatusCounts(data.sos);
  const stats: Array<[string, number, boolean]> = [
    ["SOS alerts", data.sos.length, sosCounts.active > 0],
    ["Safety events", data.events.length, false],
    ["Location records", data.locations.length, false],
    ["Children covered", data.childrenCovered, false],
  ];

  const gap = 12;
  const boxWidth = (CONTENT_WIDTH - gap * (stats.length - 1)) / stats.length;
  const boxHeight = 54;

  writer.ensure(boxHeight + 10);

  stats.forEach(([label, value, danger], index) => {
    const x = MARGIN + index * (boxWidth + gap);

    writer.page.drawRectangle({
      x,
      y: writer.y - boxHeight,
      width: boxWidth,
      height: boxHeight,
      color: COLORS.primarySoft,
      borderColor: COLORS.border,
      borderWidth: 0.75,
    });
    writer.page.drawText(value.toLocaleString("en-US"), {
      x: x + 12,
      y: writer.y - 28,
      size: 20,
      font: writer.bold,
      color: danger ? COLORS.danger : COLORS.ink,
    });
    writer.page.drawText(label.toUpperCase(), {
      x: x + 12,
      y: writer.y - 44,
      size: 8,
      font: writer.bold,
      color: COLORS.muted,
    });
  });

  writer.y -= boxHeight + 12;

  writer.note(
    `SOS status: ${sosCounts.active} active, ${sosCounts.acknowledged} acknowledged, ` +
      `${sosCounts.cancelled} cancelled.`,
  );

  const omitted = Object.entries(data.omitted).filter(([, count]) => count > 0);

  if (omitted.length > 0) {
    writer.note(
      "This report is limited per record type; not included: " +
        omitted.map(([type, count]) => `${count.toLocaleString("en-US")} ${type}`).join(", ") +
        ". Choose a shorter period or a single child for a complete report.",
    );
  }
}

export async function buildPdfReport(data: ReportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  doc.setTitle(data.title);
  doc.setAuthor("SafeTrack");
  doc.setCreationDate(data.generatedAt);

  const writer = new PdfWriter(doc, font, bold);

  // Header band.
  const bandHeight = 70;
  writer.page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - bandHeight,
    width: PAGE_WIDTH,
    height: bandHeight,
    color: COLORS.primary,
  });
  writer.page.drawText("SAFETRACK", {
    x: MARGIN,
    y: PAGE_HEIGHT - 28,
    size: 9,
    font: bold,
    color: rgb(0.8, 0.93, 0.86),
  });
  writer.page.drawText(writer.clean(data.title), {
    x: MARGIN,
    y: PAGE_HEIGHT - 52,
    size: 20,
    font: bold,
    color: COLORS.white,
  });
  writer.y = PAGE_HEIGHT - bandHeight - 16;

  writer.text(
    `Period: ${data.dateFrom} to ${data.dateTo}  |  Scope: ${data.scopeLabel}  |  ` +
      `Generated: ${manilaTime(data.generatedAt)} (Philippine time)`,
    { size: 9.5, color: COLORS.muted },
  );
  writer.y -= 22;

  drawSummary(writer, data);

  writer.heading("SOS alerts", data.sos.length);
  if (data.sos.length === 0) {
    writer.note("No SOS alerts in this period.");
  } else {
    writer.table(
      [
        { header: "Triggered (PHT)", width: 14 },
        { header: "Child", width: 16 },
        { header: "Guardian", width: 16 },
        { header: "Method", width: 11 },
        { header: "Status", width: 11 },
        { header: "Acknowledged (PHT)", width: 14 },
        { header: "Re-alerts", width: 7 },
        { header: "Location", width: 15 },
      ],
      data.sos.map((alert) => [
        manilaTime(alert.triggeredAt),
        alert.childName,
        alert.guardianName,
        methodLabel(alert.activationMethod),
        titleCase(alert.status),
        manilaTime(alert.acknowledgedAt) || "-",
        String(alert.realertCount),
        alert.latitude === null
          ? "-"
          : `${coordinate(alert.latitude)}, ${coordinate(alert.longitude)}`,
      ]),
    );
  }

  writer.heading("Safe-zone and safety events", data.events.length);
  if (data.events.length === 0) {
    writer.note("No safe-zone or safety events in this period.");
  } else {
    writer.table(
      [
        { header: "Occurred (PHT)", width: 13 },
        { header: "Child", width: 15 },
        { header: "Event", width: 15 },
        { header: "Details", width: 44, maxLines: 3 },
        { header: "AI score", width: 7 },
      ],
      data.events.map((event) => [
        manilaTime(event.occurredAt),
        event.childName,
        eventLabel(event.eventType),
        [event.title, event.details].filter(Boolean).join(": "),
        event.anomalyScore === null ? "" : event.anomalyScore.toFixed(3),
      ]),
    );
  }

  writer.heading("Location records", data.locations.length);
  if (data.locations.length === 0) {
    writer.note("No location records in this period.");
  } else {
    writer.table(
      [
        { header: "Recorded (PHT)", width: 14 },
        { header: "Child", width: 17 },
        { header: "Source", width: 10 },
        { header: "Latitude", width: 11 },
        { header: "Longitude", width: 11 },
        { header: "Accuracy (m)", width: 10 },
        { header: "Label", width: 27 },
      ],
      data.locations.map((location) => [
        manilaTime(location.recordedAt),
        location.childName,
        sourceLabel(location.source),
        coordinate(location.latitude),
        coordinate(location.longitude),
        location.accuracyMeters === null ? "" : location.accuracyMeters.toFixed(0),
        location.label ?? "",
      ]),
    );
  }

  writer.y -= 6;
  writer.note(DISCLAIMER);

  // Footer on every page, once the page count is known.
  const pages = doc.getPages();
  pages.forEach((page, index) => {
    const label = `SafeTrack Activity Report  |  ${data.dateFrom} to ${data.dateTo}`;
    const pageLabel = `Page ${index + 1} of ${pages.length}`;

    page.drawLine({
      start: { x: MARGIN, y: MARGIN + 12 },
      end: { x: PAGE_WIDTH - MARGIN, y: MARGIN + 12 },
      thickness: 0.5,
      color: COLORS.border,
    });
    page.drawText(label, { x: MARGIN, y: MARGIN, size: 8, font, color: COLORS.muted });
    page.drawText(pageLabel, {
      x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(pageLabel, 8),
      y: MARGIN,
      size: 8,
      font,
      color: COLORS.muted,
    });
  });

  return await doc.save();
}

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------

type Cell = string | number | null;

function sheet(headers: string[], rows: Cell[][], widths: number[]) {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  worksheet["!cols"] = widths.map((wch) => ({ wch }));

  if (rows.length > 0) {
    worksheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: rows.length, c: headers.length - 1 },
      }),
    };
  }

  return worksheet;
}

export function buildExcelReport(data: ReportData): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const sosCounts = sosStatusCounts(data.sos);

  const summaryRows: Cell[][] = [
    [data.title],
    [],
    ["Period", `${data.dateFrom} to ${data.dateTo}`],
    ["Scope", data.scopeLabel],
    ["Generated (Philippine time)", manilaTime(data.generatedAt)],
    [],
    ["Record type", "Count"],
    ["SOS alerts", data.sos.length],
    ["  Active", sosCounts.active],
    ["  Acknowledged", sosCounts.acknowledged],
    ["  Cancelled", sosCounts.cancelled],
    ["Safe-zone and safety events", data.events.length],
    ["Location records", data.locations.length],
    ["Children covered", data.childrenCovered],
  ];

  const omitted = Object.entries(data.omitted).filter(([, count]) => count > 0);

  if (omitted.length > 0) {
    summaryRows.push(
      [],
      ["Not included (limit reached)"],
      ...omitted.map(([type, count]): Cell[] => [type, count]),
    );
  }

  summaryRows.push([], ["Notice", DISCLAIMER]);

  const summary = XLSX.utils.aoa_to_sheet(summaryRows);
  summary["!cols"] = [{ wch: 30 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(workbook, summary, "Summary");

  XLSX.utils.book_append_sheet(
    workbook,
    sheet(
      [
        "Triggered (PHT)",
        "Child",
        "Guardian",
        "Method",
        "Status",
        "Acknowledged (PHT)",
        "Re-alerts",
        "Latitude",
        "Longitude",
      ],
      data.sos.map((alert) => [
        manilaTime(alert.triggeredAt),
        alert.childName,
        alert.guardianName,
        methodLabel(alert.activationMethod),
        titleCase(alert.status),
        manilaTime(alert.acknowledgedAt),
        alert.realertCount,
        alert.latitude,
        alert.longitude,
      ]),
      [18, 24, 24, 14, 14, 20, 10, 12, 12],
    ),
    "SOS Alerts",
  );

  XLSX.utils.book_append_sheet(
    workbook,
    sheet(
      ["Occurred (PHT)", "Child", "Event", "Title", "Details", "AI score", "Latitude", "Longitude"],
      data.events.map((event) => [
        manilaTime(event.occurredAt),
        event.childName,
        eventLabel(event.eventType),
        event.title ?? "",
        event.details ?? "",
        event.anomalyScore,
        event.latitude,
        event.longitude,
      ]),
      [18, 24, 24, 30, 70, 10, 12, 12],
    ),
    "Safety Events",
  );

  XLSX.utils.book_append_sheet(
    workbook,
    sheet(
      ["Recorded (PHT)", "Child", "Source", "Latitude", "Longitude", "Accuracy (m)", "Label"],
      data.locations.map((location) => [
        manilaTime(location.recordedAt),
        location.childName,
        sourceLabel(location.source),
        location.latitude,
        location.longitude,
        location.accuracyMeters,
        location.label ?? "",
      ]),
      [18, 24, 12, 12, 12, 13, 36],
    ),
    "Location Logs",
  );

  const buffer: ArrayBuffer = XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
    compression: true,
  });

  return new Uint8Array(buffer);
}
