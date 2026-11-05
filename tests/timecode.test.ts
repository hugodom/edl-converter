import { describe, expect, it } from 'vitest';
import { framesToTC, getFrameRate, parseTime } from '../src/core/timecode';

const r25 = getFrameRate('25');
const df = getFrameRate('29.97df');
const r24 = getFrameRate('24');

describe('parseTime', () => {
  it('parses MM:SS, HH:MM:SS and HH:MM:SS:FF', () => {
    expect(parseTime('00:12', r25)).toBe(300);
    expect(parseTime('1:02:03', r25)).toBe(3723 * 25);
    expect(parseTime('01:02:03:04', r25)).toBe(3723 * 25 + 4);
  });

  it('parses fractional seconds', () => {
    expect(parseTime('00:00:01.500', r24)).toBe(36);
    expect(parseTime('00:12,4', r25)).toBe(310);
  });

  it('parses plain seconds and Excel time fractions', () => {
    expect(parseTime('12.4', r25)).toBe(310);
    expect(parseTime(12, r25)).toBe(300);
    expect(parseTime(12 / 86400, r25)).toBe(300);
    expect(parseTime(0.5, r25)).toBe(43200 * 25);
  });

  it('rejects garbage and out-of-range values', () => {
    expect(parseTime('', r25)).toBeNull();
    expect(parseTime('hello', r25)).toBeNull();
    expect(parseTime('00:75', r25)).toBeNull();
    expect(parseTime('00:00:01:25', r25)).toBeNull(); // frame 25 does not exist at 25 fps
    expect(parseTime(-1, r25)).toBeNull();
  });

  it('keeps the typed label in drop-frame mode', () => {
    expect(parseTime('00:10:00', df)).toBe(17982);
    expect(framesToTC(parseTime('00:10:00', df)!, df)).toBe('00:10:00;00');
    expect(framesToTC(parseTime('01:00:00', df)!, df)).toBe('01:00:00;00');
  });
});

describe('framesToTC', () => {
  it('formats non-drop timecode', () => {
    expect(framesToTC(300, r25)).toBe('00:00:12:00');
    expect(framesToTC(90000 + 13, r25)).toBe('01:00:00:13');
  });

  it('skips frames 00 and 01 at drop-frame minute boundaries', () => {
    expect(framesToTC(1799, df)).toBe('00:00:59;29');
    expect(framesToTC(1800, df)).toBe('00:01:00;02');
    expect(framesToTC(17981, df)).toBe('00:09:59;29');
  });

  it('round-trips every frame for the first hours (all rates)', () => {
    for (const id of ['24', '25', '29.97df', '29.97ndf', '59.94df', '60']) {
      const rate = getFrameRate(id);
      for (let n = 0; n < 500_000; n += 7) {
        const tc = framesToTC(n, rate);
        const [h, m, s, f] = tc.split(/[:;]/).map(Number);
        const back = parseTime(`${h}:${m}:${s}:${f}`, rate);
        expect(back, `${id} frame ${n} -> ${tc}`).toBe(n);
      }
    }
  });
});
