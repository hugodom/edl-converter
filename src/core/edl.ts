import type { Cue } from './cues';
import { framesToTC, type FrameRate } from './timecode';

export const MARKER_COLORS = [
  'YELLOW',
  'RED',
  'GREEN',
  'BLUE',
  'CYAN',
  'MAGENTA',
  'BLACK',
  'WHITE',
] as const;
export type MarkerColor = (typeof MARKER_COLORS)[number];

export interface EdlOptions {
  title: string;
  rate: FrameRate;
  /** frames added to every cue (e.g. 01:00:00:00 session start) */
  offset: number;
  color: MarkerColor;
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * Build a CMX3600 EDL. Each cue becomes one event on V with a `* LOC:` locator
 * (imports as a marker in Resolve / Premiere / Avid) and a `* FROM CLIP NAME:` comment.
 */
export function buildEDL(cues: Cue[], opts: EdlOptions): string {
  const { rate } = opts;
  const tc = (frames: number) => framesToTC(frames + opts.offset, rate);
  const lines: string[] = [
    `TITLE: ${oneLine(opts.title) || 'Untitled'}`,
    `FCM: ${rate.dropFrame ? 'DROP FRAME' : 'NON-DROP FRAME'}`,
    '',
  ];

  cues.forEach((cue, i) => {
    const end = cue.end ?? cue.start + 1;
    const start = tc(cue.start);
    const stop = tc(end);
    const num = String(i + 1).padStart(3, '0');
    const text = oneLine(cue.text);
    lines.push(`${num}  AX       V     C        ${start} ${stop} ${start} ${stop}`);
    if (text) {
      lines.push(`* FROM CLIP NAME: ${text}`);
      lines.push(`* LOC: ${start} ${opts.color.padEnd(7)} ${text}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}
