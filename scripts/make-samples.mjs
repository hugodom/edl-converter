// Generates public/samples/sample.xlsx and sample.docx. Run: node scripts/make-samples.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { utils, write } from 'xlsx';
import { makeDocx } from './docx-fixture.mjs';

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
writeFileSync('public/samples/sample.docx', Buffer.from(await makeDocx(lines)));
console.log('Wrote public/samples/sample.xlsx and sample.docx');
