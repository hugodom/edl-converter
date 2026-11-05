/** A timed text entry. Times are absolute frame counts at the selected frame rate. */
export interface Cue {
  /** 1-based source row / line number, for warnings */
  source: number;
  start: number;
  /** null until resolved by `fillEnds` */
  end: number | null;
  text: string;
}

export interface ParseResult {
  cues: Cue[];
  warnings: string[];
}

/**
 * Sort cues chronologically, fill missing end times with the next cue's start (the last cue gets
 * `defaultDuration` frames), and flag zero-length and overlapping cues.
 *
 * Sorting matters: a CMX3600 EDL must list events in ascending record order, but spreadsheets
 * (e.g. grouped by character or section) are often not in time order. The sort is stable, so cues
 * with the same start keep their sheet order.
 */
export function fillEnds(cues: Cue[], defaultDuration: number, warnings: string[]): Cue[] {
  const out = cues.map((c) => ({ ...c })).sort((a, b) => a.start - b.start);
  if (out.some((cue, i) => cues[i].source !== cue.source)) {
    warnings.push('Rows were not in time order; events have been sorted by start time.');
  }
  for (let i = 0; i < out.length; i++) {
    const cue = out[i];
    if (cue.end === null) {
      const next = out[i + 1];
      cue.end = next && next.start > cue.start ? next.start : cue.start + defaultDuration;
    }
    if (cue.end <= cue.start) {
      warnings.push(`Row ${cue.source}: end time is not after start time; set to ${defaultDuration} frames long.`);
      cue.end = cue.start + Math.max(1, defaultDuration);
    }
    const next = out[i + 1];
    if (next && cue.end > next.start) {
      // Strict EDL importers may reject events whose record times overlap.
      warnings.push(`Row ${cue.source}: ends after the next row starts (overlap); some editors may reject the EDL.`);
    }
  }
  return out;
}
