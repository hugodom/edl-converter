// The prebuilt browser bundle avoids relying on bundler support for mammoth's `browser` field map.
import mammoth from 'mammoth/mammoth.browser.js';
import { fillEnds, type Cue, type ParseResult } from './cues';
import { parseTime, type FrameRate } from './timecode';

export interface DocxOptions {
  rate: FrameRate;
  defaultDuration: number;
}

/** Leading timecode: MM:SS, HH:MM:SS or HH:MM:SS:FF (optionally in [] or ()), then optional separator. */
const LINE_RE = /^\s*[[(]?(\d{1,2}(?::\d{2}){1,3}(?:[.,]\d{1,3})?)[\])]?\s*(?:[-–—:|]\s*|\s+)?(.*)$/;

/** Extract the plain text of a .docx (one paragraph per line). */
export async function docxToText(data: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer: data });
  return result.value;
}

/**
 * Turn timecoded lines into cues. A line without a leading timecode is treated as a
 * continuation of the previous cue. Each cue ends where the next one starts.
 */
export function textToCues(text: string, opts: DocxOptions): ParseResult {
  const warnings: string[] = [];
  const cues: Cue[] = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const m = LINE_RE.exec(line);
    const start = m ? parseTime(m[1], opts.rate) : null;

    if (m && start !== null) {
      cues.push({ source: i + 1, start, end: null, text: m[2].trim() });
    } else if (cues.length > 0) {
      const last = cues[cues.length - 1];
      last.text = `${last.text} ${line}`.trim();
    } else {
      warnings.push(`Line ${i + 1}: no timecode found before the first cue; line ignored.`);
    }
  });

  if (cues.length === 0) warnings.push('No timecoded lines found (expected e.g. "00:12 Some text").');
  return { cues: fillEnds(cues, opts.defaultDuration, warnings), warnings };
}

export async function parseDocx(data: ArrayBuffer, opts: DocxOptions): Promise<ParseResult> {
  return textToCues(await docxToText(data), opts);
}
