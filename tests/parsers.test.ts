import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { utils, write } from 'xlsx';
import { parseDocx, textToCues } from '../src/core/parseDocx';
import { parseXlsx } from '../src/core/parseXlsx';
import { getFrameRate } from '../src/core/timecode';

const rate = getFrameRate('25');
const base = { rate, defaultDuration: 50 };

function makeXlsx(rows: unknown[][]): ArrayBuffer {
  const ws = utils.aoa_to_sheet(rows);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Sheet1');
  const out = write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return out;
}

async function makeDocx(paragraphs: string[]): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  const body = paragraphs
    .map((p) => `<w:p><w:r><w:t xml:space="preserve">${p}</w:t></w:r></w:p>`)
    .join('');
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
  );
  return zip.generateAsync({ type: 'arraybuffer' });
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
    const data = await makeDocx(['00:01 Intro', '00:05 Main &amp; more', '00:09 Outro']);
    const { cues, warnings } = await parseDocx(data, base);
    expect(warnings).toEqual([]);
    expect(cues.map((c) => c.text)).toEqual(['Intro', 'Main & more', 'Outro']);
    expect(cues.map((c) => c.start)).toEqual([25, 125, 225]);
  });
});
