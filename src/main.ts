import './style.css';
import type { Cue } from './core/cues';
import { buildEDL, MARKER_COLORS, type MarkerColor } from './core/edl';
import { parseDocx } from './core/parseDocx';
import { readSheet, sheetToCues, type ColumnMap, type SheetPreview } from './core/parseXlsx';
import { DEFAULT_FRAME_RATE, FRAME_RATES, framesToTC, getFrameRate, parseTime } from './core/timecode';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const dropzone = $<HTMLLabelElement>('dropzone');
const fileInput = $<HTMLInputElement>('file');
const filenameEl = $('filename');
const optionsEl = $('options');
const titleEl = $<HTMLInputElement>('title');
const fpsEl = $<HTMLSelectElement>('fps');
const offsetEl = $<HTMLInputElement>('offset');
const durationEl = $<HTMLInputElement>('duration');
const colorEl = $<HTMLSelectElement>('color');
const columnsEl = $('columns');
const colSelects = {
  start: $<HTMLSelectElement>('col-start'),
  end: $<HTMLSelectElement>('col-end'),
  text: $<HTMLSelectElement>('col-text'),
};
const messagesEl = $('messages');
const resultEl = $('result');
const countEl = $('count');
const rowsEl = $('rows');
const downloadBtn = $<HTMLButtonElement>('download');
const copyBtn = $<HTMLButtonElement>('copy');

type Loaded =
  | { kind: 'xlsx'; name: string; sheet: SheetPreview }
  | { kind: 'docx'; name: string; data: ArrayBuffer };

let loaded: Loaded | null = null;
let currentEdl = '';
let currentName = 'export';

// ---- populate selects ------------------------------------------------------
fpsEl.innerHTML = FRAME_RATES.map((r) => `<option value="${r.id}">${r.label}</option>`).join('');
fpsEl.value = DEFAULT_FRAME_RATE.id;
colorEl.innerHTML = MARKER_COLORS.map((c) => `<option>${c}</option>`).join('');

// ---- file intake -----------------------------------------------------------
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});
['dragenter', 'dragover'].forEach((t) =>
  dropzone.addEventListener(t, (e) => {
    e.preventDefault();
    dropzone.classList.add('over');
  }),
);
['dragleave', 'drop'].forEach((t) =>
  dropzone.addEventListener(t, (e) => {
    e.preventDefault();
    dropzone.classList.remove('over');
  }),
);
dropzone.addEventListener('drop', (e) => {
  const file = (e as DragEvent).dataTransfer?.files?.[0];
  if (file) void loadFile(file);
});
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) void loadFile(file);
  fileInput.value = '';
});

async function loadFile(file: File): Promise<void> {
  showMessages([]);
  const ext = file.name.split('.').pop()?.toLowerCase();
  try {
    const data = await file.arrayBuffer();
    if (ext === 'docx') {
      loaded = { kind: 'docx', name: file.name, data };
    } else if (ext === 'xlsx' || ext === 'xlsm' || ext === 'xls') {
      const sheet = readSheet(data);
      loaded = { kind: 'xlsx', name: file.name, sheet };
      fillColumnSelects(sheet);
    } else {
      throw new Error('Unsupported file type. Please drop an .xlsx or .docx file.');
    }
  } catch (err) {
    loaded = null;
    optionsEl.hidden = true;
    resultEl.hidden = true;
    showMessages([err instanceof Error ? err.message : String(err)], true);
    return;
  }

  currentName = file.name.replace(/\.[^.]+$/, '');
  filenameEl.textContent = file.name;
  if (!titleEl.value || titleEl.dataset.auto === '1') {
    titleEl.value = currentName;
    titleEl.dataset.auto = '1';
  }
  optionsEl.hidden = false;
  columnsEl.hidden = loaded.kind !== 'xlsx';
  await refresh();
}

function fillColumnSelects(sheet: SheetPreview): void {
  const opts = sheet.headers.map((h, i) => `<option value="${i}">${escapeHtml(h)}</option>`).join('');
  colSelects.start.innerHTML = opts;
  colSelects.text.innerHTML = opts;
  colSelects.end.innerHTML = `<option value="-1">(none: use next start)</option>${opts}`;
  colSelects.start.value = String(sheet.columns.start);
  colSelects.end.value = String(sheet.columns.end);
  colSelects.text.value = String(sheet.columns.text);
}

// ---- conversion ------------------------------------------------------------
async function refresh(): Promise<void> {
  if (!loaded) return;
  const rate = getFrameRate(fpsEl.value);
  const warnings: string[] = [];

  const durationSec = parseFloat(durationEl.value);
  const defaultDuration = Math.max(1, Math.round((Number.isFinite(durationSec) ? durationSec : 3) * rate.nominal));

  const offsetParsed = offsetEl.value.trim() === '' ? 0 : parseTime(offsetEl.value, rate);
  offsetEl.classList.toggle('invalid', offsetParsed === null);
  if (offsetParsed === null) warnings.push('Start timecode is not valid (use HH:MM:SS:FF); using 00:00:00:00.');
  const offset = offsetParsed ?? 0;

  let cues: Cue[];
  try {
    const result =
      loaded.kind === 'xlsx'
        ? sheetToCues(loaded.sheet, {
            rate,
            defaultDuration,
            columns: readColumns(),
          })
        : await parseDocx(loaded.data, { rate, defaultDuration });
    cues = result.cues;
    warnings.push(...result.warnings);
  } catch (err) {
    resultEl.hidden = true;
    showMessages([...warnings, err instanceof Error ? err.message : String(err)], true);
    return;
  }

  showMessages(warnings);
  currentEdl = buildEDL(cues, {
    title: titleEl.value,
    rate,
    offset,
    color: colorEl.value as MarkerColor,
  });
  renderRows(cues, (f) => framesToTC(f + offset, rate));
  resultEl.hidden = false;
  downloadBtn.disabled = copyBtn.disabled = cues.length === 0;
}

function readColumns(): ColumnMap {
  return {
    start: Number(colSelects.start.value),
    end: Number(colSelects.end.value),
    text: Number(colSelects.text.value),
  };
}

function renderRows(cues: Cue[], tc: (frames: number) => string): void {
  countEl.textContent = String(cues.length);
  const frag = document.createDocumentFragment();
  cues.forEach((cue, i) => {
    const tr = document.createElement('tr');
    const cells: [string, string?][] = [
      [String(i + 1)],
      [tc(cue.start), 'tc'],
      [tc(cue.end ?? cue.start), 'tc'],
      [cue.text],
    ];
    for (const [text, cls] of cells) {
      const td = document.createElement('td');
      td.textContent = text;
      if (cls) td.className = cls;
      tr.append(td);
    }
    frag.append(tr);
  });
  rowsEl.replaceChildren(frag);
}

function showMessages(messages: string[], isError = false): void {
  messagesEl.hidden = messages.length === 0;
  messagesEl.classList.toggle('error', isError);
  const ul = document.createElement('ul');
  for (const m of messages.slice(0, 20)) {
    const li = document.createElement('li');
    li.textContent = m;
    ul.append(li);
  }
  if (messages.length > 20) {
    const li = document.createElement('li');
    li.textContent = `…and ${messages.length - 20} more`;
    ul.append(li);
  }
  messagesEl.replaceChildren(ul);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

// ---- option wiring & output ------------------------------------------------
for (const el of [fpsEl, offsetEl, durationEl, colorEl, colSelects.start, colSelects.end, colSelects.text]) {
  el.addEventListener('input', () => void refresh());
}
titleEl.addEventListener('input', () => {
  titleEl.dataset.auto = '0';
  void refresh();
});

downloadBtn.addEventListener('click', () => {
  const blob = new Blob([currentEdl], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentName}.edl`;
  a.click();
  URL.revokeObjectURL(url);
});

copyBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(currentEdl);
  copyBtn.textContent = 'Copied!';
  setTimeout(() => (copyBtn.textContent = 'Copy'), 1500);
});
