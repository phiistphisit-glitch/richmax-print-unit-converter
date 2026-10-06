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
