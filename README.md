# XLSX / DOCX → EDL converter

Turn timed text into a **CMX3600 EDL** you can import into your video editor. Drop an Excel sheet (`START TIME`, `END TIME`, `TEXT`) or a Word document with timecoded lines, check the preview, and download the `.edl`. Each line becomes an event with a locator, which editors can import as a marker.

**Everything runs in your browser. Your files are never uploaded anywhere.**

👉 **Use it online: https://hugodom.github.io/edl-converter/**

---

## Table of contents

- [How to use it](#how-to-use-it)
- [Input formats](#input-formats)
- [What the EDL looks like](#what-the-edl-looks-like)
- [Options](#options)
- [Run it locally](#run-it-locally)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## How to use it

1. **Open the tool** (link above, or [run it locally](#run-it-locally)).
2. **Drop your file** on the box, or click it to choose one. Both `.xlsx` and `.docx` are accepted. No file handy? Download `sample.xlsx` or `sample.docx` from the links on the page.
3. **Check the options** that appear: title, frame rate, start timecode, length of the last cue and marker color. The preview updates instantly.
4. **Check the preview table.** Any problem (an unreadable time, overlapping cues) shows up as a yellow warning above it. For spreadsheets, if the wrong columns were picked, fix them with the START / END / TEXT column selectors.
5. **Click "Download .edl"** (or "Copy" to put the EDL on your clipboard) and import it into your editor.

> Set the **frame rate to match your timeline** before downloading. A wrong frame rate shifts every timecode.

## Input formats

### Excel (`.xlsx`)

The first sheet is read. It needs a header row with these columns, in any order and in any letter case:

| START TIME  | END TIME    | TEXT                |
| ----------- | ----------- | ------------------- |
| 00:00:01:00 | 00:00:04:00 | Welcome to the show |
| 00:00:04:12 | 00:00:08:00 | Next line           |

- Common alternatives are recognized too: `Start` / `In`, `End` / `Out`, and `Subtitle` / `Caption` / `Dialogue` for the text column.
- Times can be typed as text (`MM:SS`, `HH:MM:SS`, `HH:MM:SS:FF`, with an optional `.mmm` fraction) or be real Excel time cells.
- A plain number of 1 or more is read as seconds.
- The **END column is optional.** A missing end becomes the next row's start, and the last cue uses the "Last cue length" option.
- If the header isn't recognized, the first three columns are assumed to be START, END, TEXT.

### Word (`.docx`)

One cue per line, each starting with a timecode:

```
00:12 Welcome to the show
00:20 - Next line
[01:05] The last one
```

- `MM:SS`, `HH:MM:SS` and `HH:MM:SS:FF` are detected automatically. A timecode can optionally be wrapped in `[]` or `()` and followed by `-`, `:` or `|`.
- Each cue ends where the next one starts. The last cue uses the "Last cue length" option.
- A line **without** a timecode is appended to the previous cue, so wrapped text stays together.

## What the EDL looks like

```
TITLE: My Show
FCM: NON-DROP FRAME

001  AX       V     C        01:00:01:00 01:00:04:00 01:00:01:00 01:00:04:00
* FROM CLIP NAME: Welcome to the show
* LOC: 01:00:01:00 YELLOW  Welcome to the show
```

Each row of your file becomes one event, with a `* LOC:` locator carrying your text and a `* FROM CLIP NAME:` comment. How locators are imported depends on your editor, so test with a small file first. Corrections and reports from real-world imports are welcome as GitHub issues.

## Options

| Option | What it does |
| --- | --- |
| **EDL title** | Written to the `TITLE:` line. Defaults to the file name. |
| **Frame rate** | 23.976, 24, 25 (default), 29.97 non-drop / drop-frame, 30, 50, 59.94 non-drop / drop-frame, 60. |
| **Start timecode** | Added to every time. Defaults to `01:00:00:00`, the usual timeline start. Use `00:00:00:00` for none. |
| **Last cue length** | How long the final cue lasts when nothing marks its end. |
| **Marker color** | Color written on each locator (yellow, red, green, blue, cyan, magenta, black, white). |

The times in your file are treated as timecode labels. In drop-frame mode, `00:10:00` comes out as `00:10:00;00`.

## Run it locally

Running locally is useful if you want to work offline, tweak the tool, or avoid the hosted page. You need [Node.js](https://nodejs.org) 20.19+ (or 22.12+) and [Git](https://git-scm.com).

```bash
# 1. Get the code
git clone https://github.com/hugodom/edl-converter.git
cd edl-converter

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Then open **http://localhost:5173/edl-converter/**. The `/edl-converter/` part of the address is required because the app is built to be served from that sub-path (for GitHub Pages). Vite prints the exact address if port 5173 is taken.

### Build a standalone copy

```bash
npm run build      # type-check and build into dist/
npm run preview    # serve the built site locally
```

The preview server also serves the app at `/edl-converter/`. To host the `dist/` folder somewhere else, such as the root of your own server, change `base` in `vite.config.ts` first and rebuild.

## Development

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm test` | Run the unit tests (Vitest) |
| `npm run test:watch` | Tests in watch mode |
| `npm run build` | Type-check and production build |
| `node scripts/make-samples.mjs` | Regenerate `public/samples/` |

Project layout:

```
src/core/timecode.ts    frame-rate math, drop-frame, time parsing
src/core/edl.ts         CMX3600 EDL writer
src/core/parseXlsx.ts   spreadsheet reader, column detection
src/core/parseDocx.ts   Word reader, timecoded-line parser
src/core/cues.ts        shared cue type, end-time filling, warnings
src/main.ts             UI wiring (drop zone, options, preview, download)
tests/                  unit tests for all of the above
scripts/                sample-file generator and shared docx fixture builder
```

Built with [Vite](https://vite.dev), [SheetJS](https://sheetjs.com) (`xlsx`, installed from the SheetJS CDN because the npm registry copy is outdated) and [mammoth](https://github.com/mwilliamson/mammoth.js). Pushes to `main` are tested and deployed to GitHub Pages by `.github/workflows/deploy.yml`.

## Troubleshooting

- **"Unsupported file type"**: only `.xlsx` (also `.xlsm`, `.xls`) and `.docx` are accepted. Old `.doc` files must be re-saved as `.docx`.
- **Wrong columns detected**: use the START / END / TEXT selectors under the options.
- **A row is skipped**: the warning names the row and the value that couldn't be read as a time.
- **"No timecoded lines found"** (docx): lines must *start* with a timecode, such as `00:12 text`.
- **Warnings about overlap**: a cue ends after the next one starts. Some editors reject EDLs with overlapping events, so fix the end times in your file.
- **Timecodes look shifted by an hour**: that's the default `01:00:00:00` start timecode. Set it to `00:00:00:00` if your timeline starts at zero.
- **`localhost:5173` shows a blank page or 404**: use the full address with the `/edl-converter/` path.

## License

[MIT](LICENSE)
