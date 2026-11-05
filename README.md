# XLSX / DOCX → EDL converter

A small web tool that turns timed text into a **CMX3600 EDL** you can import into DaVinci Resolve, Premiere Pro, Avid and other editors. Drop a file, check the preview, download the `.edl`.

**Everything runs in your browser. Files are never uploaded.**

Live tool: https://hugodom.github.io/edl-converter/

## Supported inputs

### Excel (`.xlsx`)
First sheet, with a header row containing these columns (any order, case-insensitive; `Start`/`In`, `End`/`Out`, `Subtitle`/`Caption`/`Dialogue` are also recognised):

| START TIME  | END TIME    | TEXT        |
| ----------- | ----------- | ----------- |
| 00:00:01:00 | 00:00:04:00 | Hello there |

- Times may be text (`MM:SS`, `HH:MM:SS`, `HH:MM:SS:FF`, optional `.mmm`) or real Excel time cells.
- A plain number ≥ 1 is read as seconds.
- The END column is optional: a missing end becomes the next row's start.
- If column detection is wrong, pick the right columns in the UI.

### Word (`.docx`)
One cue per line, starting with a timecode:

```
00:12 Welcome
00:20 - Next line
[01:05] The last one
```

`MM:SS`, `HH:MM:SS` and `HH:MM:SS:FF` are detected automatically. Each cue ends where the next one starts; the last one uses the "Last cue length" option. A line without a timecode is appended to the previous cue.

## EDL output

Each cue becomes one event with a locator, which editors import as a marker:

```
TITLE: My Show
FCM: NON-DROP FRAME

001  AX       V     C        01:00:01:00 01:00:04:00 01:00:01:00 01:00:04:00
* FROM CLIP NAME: Hello there
* LOC: 01:00:01:00 YELLOW  Hello there
```

Options: title, frame rate (23.976, 24, 25, 29.97 NDF/DF, 30, 50, 59.94 NDF/DF, 60), start timecode offset (default `01:00:00:00`) and marker colour. The times in your file are treated as timecode labels, so in drop-frame mode `00:10:00` comes out as `00:10:00;00`.

## Development

```bash
npm install
npm run dev      # local dev server
npm test         # unit tests (Vitest)
npm run build    # type-check + production build into dist/
```

Built with [Vite](https://vite.dev), [SheetJS](https://sheetjs.com) (`xlsx`, installed from the SheetJS CDN because the npm registry copy is outdated) and [mammoth](https://github.com/mwilliamson/mammoth.js). Pushes to `main` are tested and deployed to GitHub Pages by `.github/workflows/deploy.yml`.

Regenerate the sample files with `node scripts/make-samples.mjs`.

## License

MIT
