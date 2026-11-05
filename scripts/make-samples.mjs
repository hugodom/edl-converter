// Generates public/samples/sample.xlsx and sample.docx. Run: node scripts/make-samples.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import JSZip from 'jszip';
import { utils, write } from 'xlsx';

mkdirSync('public/samples', { recursive: true });

const rows = [
  ['START TIME', 'END TIME', 'TEXT'],
  ['00:00:01:00', '00:00:04:00', 'Welcome to the show'],
  ['00:00:04:12', '00:00:08:00', 'Today we talk about timecodes'],
  ['00:00:08:00', '00:00:12:12', 'Markers will appear at each line'],
  ['00:00:15:00', '00:00:18:00', 'Thanks for watching'],
];
const wb = utils.book_new();
utils.book_append_sheet(wb, utils.aoa_to_sheet(rows), 'Cues');
writeFileSync('public/samples/sample.xlsx', write(wb, { type: 'buffer', bookType: 'xlsx' }));

const lines = [
  '00:01 Welcome to the show',
  '00:04 Today we talk about timecodes',
  '00:08 Markers will appear at each line',
  '00:15 Thanks for watching',
];
const zip = new JSZip();
zip.file(
  '[Content_Types].xml',
  '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
);
zip.file(
  '_rels/.rels',
  '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
);
const body = lines.map((l) => `<w:p><w:r><w:t xml:space="preserve">${l}</w:t></w:r></w:p>`).join('');
zip.file(
  'word/document.xml',
  `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
);
writeFileSync('public/samples/sample.docx', await zip.generateAsync({ type: 'nodebuffer' }));
console.log('Wrote public/samples/sample.xlsx and sample.docx');
