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
 * Fill missing end times with the next cue's start; the last cue gets `defaultDuration` frames.
 * Also flags cues whose end is not after their start, and out-of-order starts.
 */
export function fillEnds(cues: Cue[], defaultDuration: number, warnings: string[]): Cue[] {
  const out = cues.map((c) => ({ ...c }));
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
    if (i > 0 && cue.start < out[i - 1].start) {
      warnings.push(`Row ${cue.source}: start time is earlier than the previous row.`);
    }
    const next = out[i + 1];
    if (next && cue.end > next.start && next.start >= cue.start) {
      // Strict EDL importers may reject events whose record times overlap.
      warnings.push(`Row ${cue.source}: ends after the next row starts (overlap); some editors may reject the EDL.`);
    }
  }
  return out;
}
