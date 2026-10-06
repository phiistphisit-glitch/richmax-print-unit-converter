// Extracts the pure formula block from index.html and checks it.
const fs = require("fs");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
const code = html.split("/*CALC-START*/")[1].split("/*CALC-END*/")[0];
const { filmGsm, filmSolve, paperSolve, SHEETS } = new Function(code + "; return {filmGsm, filmSolve, paperSolve, SHEETS};")();
let pass = 0, fail = 0;
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
function check(name, got, want){ const ok = near(got, want); ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}: got ${+got.toFixed(6)} want ${want}`); }

const pet = filmGsm(12, 1.40);
check("PET 12um GSM", pet, 16.8);
let r = filmSolve("m", 1000, 1000, pet);
check("PET 12u 1000mm x 1000m -> kg", r.kg, 16.8);
check("  m2", r.m2, 1000);
check("  feet", r.ft, 1000 / 0.3048);
check("  m per kg", r.mPerKg, 1000 / 16.8);
r = filmSolve("kg", 16.8, 1000, pet);  check("reverse kg->m", r.m, 1000);
r = filmSolve("ft", 3280.839895, 1000, pet); check("reverse ft->m", r.m, 1000);
r = filmSolve("m2", 1000, 1000, pet);  check("reverse m2->kg", r.kg, 16.8);
const bopp = filmGsm(20, 0.91);        check("BOPP 20u GSM", bopp, 18.2);
r = filmSolve("m", 5000, 800, bopp);   check("BOPP 20u 800mm x 5000m -> kg", r.kg, 72.8);
r = filmSolve("kg", 100, 1200, filmGsm(7, 2.70)); check("AL 7u 1200mm 100kg -> m", r.m, 100000 / (18.9 * 1.2));

const s3143 = SHEETS.find(s => s.id === "31x43");
let p = paperSolve("sheets", 10000, s3143.w, s3143.h, 300);
const a = 0.7874 * 1.0922;
check("31x43in sheet area m2", p.sheetM2, a);
check("300gsm 31x43 x10000 sheets -> kg", p.kg, 10000 * a * 300 / 1000);
check("  reams", p.reams, 20);
p = paperSolve("kg", 10000 * a * 0.3, s3143.w, s3143.h, 300); check("reverse kg->sheets", p.sheets, 10000);
p = paperSolve("sheets", 1000, 594, 841, 80);  check("A1 80gsm 1000 sheets -> kg", p.kg, 0.594 * 0.841 * 80);
p = paperSolve("reams", 2, 594, 841, 80);      check("A1 2 reams -> sheets", p.sheets, 1000);
p = paperSolve("m2", 499.554, 594, 841, 80);   check("A1 m2 -> sheets", p.sheets, 1000);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
