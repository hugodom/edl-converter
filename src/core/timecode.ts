/** Frame-rate presets offered in the UI. `nominal` is the timecode base (frames per label-second). */
export interface FrameRate {
  id: string;
  label: string;
  nominal: number;
  dropFrame: boolean;
}

export const FRAME_RATES: FrameRate[] = [
  { id: '23.976', label: '23.976 fps', nominal: 24, dropFrame: false },
  { id: '24', label: '24 fps', nominal: 24, dropFrame: false },
  { id: '25', label: '25 fps', nominal: 25, dropFrame: false },
  { id: '29.97ndf', label: '29.97 fps (non-drop)', nominal: 30, dropFrame: false },
  { id: '29.97df', label: '29.97 fps (drop-frame)', nominal: 30, dropFrame: true },
  { id: '30', label: '30 fps', nominal: 30, dropFrame: false },
  { id: '50', label: '50 fps', nominal: 50, dropFrame: false },
  { id: '59.94ndf', label: '59.94 fps (non-drop)', nominal: 60, dropFrame: false },
  { id: '59.94df', label: '59.94 fps (drop-frame)', nominal: 60, dropFrame: true },
  { id: '60', label: '60 fps', nominal: 60, dropFrame: false },
];

export const DEFAULT_FRAME_RATE = FRAME_RATES[2]; // 25 fps

export function getFrameRate(id: string): FrameRate {
  return FRAME_RATES.find((r) => r.id === id) ?? DEFAULT_FRAME_RATE;
}

/** Frames dropped per minute (except every 10th) in drop-frame timecode. */
function dropCount(nominal: number): number {
  return nominal === 60 ? 4 : 2;
}

/** Convert a timecode label (h:m:s:f) into an absolute frame count. */
export function labelToFrames(
  h: number,
  m: number,
  s: number,
  f: number,
  rate: FrameRate,
): number {
  let total = (h * 3600 + m * 60 + s) * rate.nominal + f;
  if (rate.dropFrame) {
    const totalMinutes = h * 60 + m;
    total -= dropCount(rate.nominal) * (totalMinutes - Math.floor(totalMinutes / 10));
  }
  return total;
}

/** Format an absolute frame count as HH:MM:SS:FF (or HH:MM:SS;FF for drop-frame). */
export function framesToTC(frames: number, rate: FrameRate): string {
  const { nominal, dropFrame } = rate;
  let n = Math.max(0, Math.round(frames));

  if (dropFrame) {
    const d = dropCount(nominal);
    const framesPerMin = nominal * 60 - d;
    const framesPer10Min = nominal * 600 - d * 9;
    const tenMinBlocks = Math.floor(n / framesPer10Min);
    const rem = n % framesPer10Min;
    n += d * 9 * tenMinBlocks;
    if (rem > d) n += d * Math.floor((rem - d) / framesPerMin);
  }

  const ff = n % nominal;
  const totalSeconds = Math.floor(n / nominal);
  const ss = totalSeconds % 60;
  const mm = Math.floor(totalSeconds / 60) % 60;
  const hh = Math.floor(totalSeconds / 3600);
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}${dropFrame ? ';' : ':'}${pad(ff)}`;
}

/** Turn fractional label-seconds (h/m/s plus a millisecond fraction) into a frame count. */
function msLabelToFrames(totalMs: number, rate: FrameRate): number {
  const ndf = Math.round((totalMs / 1000) * rate.nominal);
  const f = ndf % rate.nominal;
  const totalSeconds = Math.floor(ndf / rate.nominal);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  return labelToFrames(h, m, s, f, rate);
}

/**
 * Parse a timecode-like value into an absolute frame count, or `null` if it cannot be parsed.
 *
 * Accepted:
 *  - strings: `MM:SS`, `HH:MM:SS`, `HH:MM:SS:FF` (also `;` before frames), optional `.mmm` / `,mmm`
 *    fraction of a second, or a plain number of seconds (`12.5`)
 *  - numbers: < 1 is an Excel time-of-day fraction (e.g. 0.5 = 12:00:00); >= 1 is seconds
 *
 * The label you type is the label you get: in drop-frame mode `00:10:00` becomes `00:10:00;00`.
 */
export function parseTime(value: unknown, rate: FrameRate): number | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null;
    const seconds = value < 1 ? value * 86400 : value;
    return msLabelToFrames(Math.round(seconds * 1000), rate);
  }

  if (value instanceof Date) {
    const ms =
      value.getUTCHours() * 3600000 +
      value.getUTCMinutes() * 60000 +
      value.getUTCSeconds() * 1000 +
      value.getUTCMilliseconds();
    return msLabelToFrames(ms, rate);
  }

  const str = String(value).trim();
  if (!str) return null;

  if (/^\d+(?:[.,]\d+)?$/.test(str)) {
    return msLabelToFrames(Math.round(parseFloat(str.replace(',', '.')) * 1000), rate);
  }

  const m = /^(\d{1,3}(?:[:;]\d{1,2}){1,3})(?:[.,](\d{1,3}))?$/.exec(str);
  if (!m) return null;

  const parts = m[1].split(/[:;]/).map(Number);
  let h = 0;
  let min: number;
  let sec: number;
  let frames = 0;
  if (parts.length === 2) [min, sec] = parts;
  else if (parts.length === 3) [h, min, sec] = parts;
  else [h, min, sec, frames] = parts;

  if (min >= 60 || sec >= 60) return null;
  if (parts.length === 4 && frames >= rate.nominal) return null;

  if (m[2] !== undefined) {
    // fractional seconds, e.g. "00:01:02.500" -> 500 ms
    const ms = Math.round(parseFloat(`0.${m[2]}`) * 1000);
    return msLabelToFrames((h * 3600 + min * 60 + sec) * 1000 + ms, rate);
  }
  return labelToFrames(h, min, sec, frames, rate);
}
