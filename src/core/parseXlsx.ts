import { read, utils } from 'xlsx';
import { fillEnds, type Cue, type ParseResult } from './cues';
import { parseTime, type FrameRate } from './timecode';

export interface ColumnMap {
  start: number;
  end: number; // -1 = none (derive from next start)
  text: number;
}

export interface SheetPreview {
  headers: string[];
  /** header row index within `rows` (-1 if none was detected) */
  headerRow: number;
  columns: ColumnMap;
  rows: unknown[][];
}

export interface XlsxOptions {
  rate: FrameRate;
  defaultDuration: number;
  /** manual column override from the UI */
  columns?: ColumnMap;
}

const START_RE = /\b(start|begin|in)\b/;
const END_RE = /\b(end|stop|out)\b/;
const TEXT_RE = /\b(text|subtitles?|captions?|dialogue|dialog|description|comments?|notes?)\b/;

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/[_\-.]+/g, ' ');

/** Read the first non-empty sheet of a workbook into rows and guess the column mapping. */
export function readSheet(data: ArrayBuffer): SheetPreview {
  // Note: no `cellDates`, so time cells arrive as Excel day-fraction numbers.
  const wb = read(data, { type: 'array' });
  const name = wb.SheetNames.find((n) => wb.Sheets[n]?.['!ref']) ?? wb.SheetNames[0];
  if (!name) throw new Error('The workbook has no sheets.');
  const rows = utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
    header: 1,
    raw: true,
    defval: '',
    blankrows: false,
  });

  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const cells = rows[r].map(norm);
    const end = cells.findIndex((c) => END_RE.test(c));
    const start = cells.findIndex((c, i) => i !== end && START_RE.test(c));
    const text = cells.findIndex((c) => TEXT_RE.test(c));
    if (start >= 0 && text >= 0) {
      return {
        headers: rows[r].map((c, i) => String(c ?? '').trim() || `Column ${i + 1}`),
        headerRow: r,
        columns: { start, end, text },
        rows,
      };
    }
  }

  // No recognisable header: assume column order START, END, TEXT.
  const width = Math.max(0, ...rows.map((r) => r.length));
  return {
    headers: Array.from({ length: width }, (_, i) => `Column ${i + 1}`),
    headerRow: -1,
    columns: { start: 0, end: width >= 3 ? 1 : -1, text: width >= 3 ? 2 : 1 },
    rows,
  };
}

/** Convert a sheet preview into cues using the given (or detected) column mapping. */
export function sheetToCues(sheet: SheetPreview, opts: XlsxOptions): ParseResult {
  const { start, end, text } = opts.columns ?? sheet.columns;
  const warnings: string[] = [];
  if (sheet.headerRow < 0 && !opts.columns) {
    warnings.push('No header row found (expected START TIME / END TIME / TEXT); using columns A, B, C.');
  }

  const cues: Cue[] = [];
  sheet.rows.forEach((row, i) => {
    if (i <= sheet.headerRow) return;
    const rowNo = i + 1;
    const rawStart = row[start];
    const label = String(row[text] ?? '').trim();
    const isBlank = (rawStart === '' || rawStart == null) && !label;
    if (isBlank) return;

    const s = parseTime(rawStart, opts.rate);
    if (s === null) {
      warnings.push(`Row ${rowNo}: could not read start time "${String(rawStart)}"; row skipped.`);
      return;
    }
    let e: number | null = null;
    if (end >= 0 && row[end] !== '' && row[end] != null) {
      e = parseTime(row[end], opts.rate);
      if (e === null) {
        warnings.push(`Row ${rowNo}: could not read end time "${String(row[end])}"; using next start.`);
      }
    }
    cues.push({ source: rowNo, start: s, end: e, text: label });
  });

  return { cues: fillEnds(cues, opts.defaultDuration, warnings), warnings };
}

export function parseXlsx(data: ArrayBuffer, opts: XlsxOptions): ParseResult {
  return sheetToCues(readSheet(data), opts);
}
