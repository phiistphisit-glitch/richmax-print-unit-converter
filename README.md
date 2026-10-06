# RICHMAX Print Unit Converter

Single-page printing-industry unit converter (skills demo) for RICHMAX INTERPRINT — gravure film rolls and offset paper sheets. Bilingual Thai / English, no build step, one self-contained `index.html`.

**Live:** https://phiistphisit-glitch.github.io/richmax-print-unit-converter/

## Modes
- **Film rolls (gravure):** material preset (PET, BOPP, CPP, LLDPE, Nylon/PA, AL foil, PVC shrink) or custom density + thickness, or direct GSM; web width; type any one of meters / feet / kg / m² — the others update instantly. Also shows linear m per kg.
- **Paper sheets (offset):** GSM preset (80–350) or custom, sheet size preset (31×43", 24×35", 25×36", 28×40", A1) or custom mm; type any one of sheets / kg / reams (500) / m².

## Formulas
- GSM = thickness (µm) × density (g/cm³)
- area m² = length m × width m; kg = area m² × GSM / 1000; feet = m / 0.3048
- Paper: kg = sheets × sheet area m² × GSM / 1000

Results are theoretical and exclude cores, waste/trim and moisture.

## Test
`node test_formulas.js` — extracts the formula block from `index.html` and checks known cases (e.g. PET 12 µm × 1000 mm × 1000 m = 16.8 kg).

Demo by RICHMAX bot team.

## Google Sheets sharing (team log)
- Section 3 of the page: optional name (remembered on the device), optional note, **Save to Google Sheet** button, **Auto-send after each calculation** toggle (sends only after inputs are stable ~2 s, never repeats the last row sent), and a status pill (not connected / ready / waiting / sent / failed).
- Backend: Google Apps Script web app bound to the sheet — see [`apps-script/Code.gs`](apps-script/Code.gs) (doPost appends a row with LockService + shared token, then a throttled MailApp notification; doGet health check). Setup guide (Thai): [`SETUP_GOOGLE_SHEET_TH.md`](SETUP_GOOGLE_SHEET_TH.md).
- The Web App URL is the `SHEETS_WEBAPP_URL` constant near the top of `index.html` (empty = not connected). Settings → URL overrides it on one device (localStorage).
- `SHEETS_TOKEN` is visible in this public repo — a demo-level filter, not a secret.
- Tests: `node apps-script/test_code_gs.js` (offline mocks of SpreadsheetApp/MailApp/LockService); `tests/ui_test.js` (headless Chrome + `tests/mock_server.py` recording POSTs).
