import { describe, expect, it } from 'vitest';
import { utils, write } from 'xlsx';
import { makeDocx } from '../scripts/docx-fixture.mjs';
import { buildEDL } from '../src/core/edl';
import { parseDocx, textToCues } from '../src/core/parseDocx';
import { parseXlsx } from '../src/core/parseXlsx';
import { getFrameRate } from '../src/core/timecode';

const rate = getFrameRate('25');
const base = { rate, defaultDuration: 50 };

function makeXlsx(rows: unknown[][]): ArrayBuffer {
  const ws = utils.aoa_to_sheet(rows);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Sheet1');
  return write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

describe('parseXlsx', () => {
  it('reads START TIME / END TIME / TEXT with string times', () => {
    const { cues, warnings } = parseXlsx(
      makeXlsx([
        ['START TIME', 'END TIME', 'TEXT'],
        ['00:00:01:00', '00:00:03:12', 'First'],
        ['00:00:04:00', '00:00:06:00', 'Second'],
      ]),
      base,
    );
    expect(warnings).toEqual([]);
    expect(cues).toEqual([
      { source: 2, start: 25, end: 87, text: 'First' },
      { source: 3, start: 100, end: 150, text: 'Second' },
    ]);
  });

  it('reads numeric Excel time cells and tolerates header variations / column order', () => {
    const { cues } = parseXlsx(
      makeXlsx([
        ['Text', 'Time Out', 'Time In'],
        ['A', 5 / 86400, 2 / 86400],
      ]),
      base,
    );
    expect(cues).toEqual([{ source: 2, start: 50, end: 125, text: 'A' }]);
  });

  it('derives missing end times from the next start, last gets the default duration', () => {
    const { cues } = parseXlsx(
      makeXlsx([
        ['START TIME', 'END TIME', 'TEXT'],
        ['00:00:01', '', 'A'],
        ['00:00:05', '', 'B'],
      ]),
      base,
    );
    expect(cues.map((c) => [c.start, c.end])).toEqual([
      [25, 125],
      [125, 175],
    ]);
  });

  it('sorts rows that are not in time order, keeping each text with its own time', () => {
    // Shaped like a real ADR sheet: grouped by character, so times jump backwards.
    const { cues, warnings } = parseXlsx(
      makeXlsx([
        ['Track', 'Start Time', 'End Time', 'Text'],
        ['A', '07:19:03:00', '07:19:06:00', 'late'],
        ['B', '07:01:40:16', '07:01:43:08', 'early'],
        ['B', '07:05:39:11', '07:05:39:15', 'middle'],
      ]),
      base,
    );
    expect(cues.map((c) => c.text)).toEqual(['early', 'middle', 'late']);
    expect(cues.map((c) => c.source)).toEqual([3, 4, 2]);
    expect(cues.every((c, i) => i === 0 || c.start >= cues[i - 1].start)).toBe(true);
    expect(warnings.some((w) => /sorted/.test(w))).toBe(true);
  });

  it('writes EDL events in ascending record order', () => {
    const { cues } = parseXlsx(
      makeXlsx([
        ['START TIME', 'END TIME', 'TEXT'],
        ['00:00:30:00', '00:00:32:00', 'c'],
        ['00:00:10:00', '00:00:12:00', 'a'],
        ['00:00:20:00', '00:00:22:00', 'b'],
      ]),
      base,
    );
    const edl = buildEDL(cues, { title: 't', rate, offset: 0, color: 'YELLOW' });
    const recIns = [...edl.matchAll(/^\d{3}\s+AX\s+V\s+C\s+\S+ \S+ (\S+) \S+$/gm)].map((m) => m[1]);
    expect(recIns).toEqual(['00:00:10:00', '00:00:20:00', '00:00:30:00']);
    expect([...edl.matchAll(/^\* LOC: \S+ \S+\s+(.*)$/gm)].map((m) => m[1])).toEqual(['a', 'b', 'c']);
  });

  it('warns when a cue overlaps the next one', () => {
    const { warnings } = parseXlsx(
      makeXlsx([
        ['START TIME', 'END TIME', 'TEXT'],
        ['00:00:01', '00:00:06', 'A'],
        ['00:00:04', '00:00:08', 'B'],
      ]),
      base,
    );
    expect(warnings.some((w) => /Row 2.*overlap/.test(w))).toBe(true);
  });

  it('warns about unreadable times and skips the row', () => {
    const { cues, warnings } = parseXlsx(
      makeXlsx([
        ['START TIME', 'END TIME', 'TEXT'],
        ['nope', '00:00:02', 'bad'],
        ['00:00:01', '00:00:02', 'ok'],
      ]),
      base,
    );
    expect(cues).toHaveLength(1);
    expect(warnings[0]).toMatch(/Row 2/);
  });
});

describe('textToCues / parseDocx', () => {
  it('parses MM:SS lines, using the next start as the end', () => {
    const { cues, warnings } = textToCues('00:12 Hello\n00:20 - World\n[01:05] Last', base);
    expect(warnings).toEqual([]);
    expect(cues.map((c) => [c.start, c.end, c.text])).toEqual([
      [300, 500, 'Hello'],
      [500, 1625, 'World'],
      [1625, 1675, 'Last'],
    ]);
  });

  it('accepts HH:MM:SS and HH:MM:SS:FF, and joins continuation lines', () => {
    const { cues } = textToCues('01:00:00 One\nstill one\n01:00:02:10 Two', base);
    expect(cues.map((c) => c.text)).toEqual(['One still one', 'Two']);
    expect(cues[1].start).toBe(3600 * 25 + 50 + 10);
  });

  it('warns when a document has no timecodes', () => {
    const { cues, warnings } = textToCues('just text', base);
    expect(cues).toHaveLength(0);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('reads a real .docx file', async () => {
    const data = await makeDocx(['00:01 Intro', '00:05 Main & more', '00:09 Outro']);
    const { cues, warnings } = await parseDocx(data, base);
    expect(warnings).toEqual([]);
    expect(cues.map((c) => c.text)).toEqual(['Intro', 'Main & more', 'Outro']);
    expect(cues.map((c) => c.start)).toEqual([25, 125, 225]);
  });
});
