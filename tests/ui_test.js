const { chromium } = require("/tmp/pwtest/node_modules/playwright-core");
const BASE = process.argv[2] || "http://127.0.0.1:8765/";
const SHOTS = "/workspace/richmax/print-unit-converter-shots";
const MOCK = "http://127.0.0.1:8765/exec";
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${x !== undefined ? "  -> " + x : ""}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1500 } });
  const errors = []; page.on("pageerror", e => errors.push(String(e))); page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  const posts = async () => (await (await fetch("http://127.0.0.1:8765/__posts")).json()).map(p => ({ ...p, json: JSON.parse(p.body) }));
  await fetch("http://127.0.0.1:8765/__reset");
  const val = id => page.inputValue("#" + id);
  const type = async (id, v) => { await page.fill("#" + id, ""); await page.type("#" + id, v, { delay: 120 }); };
  const status = () => page.textContent("#s-status");

  // ---- A: no URL set ----
  await page.goto(BASE); await page.evaluate(() => localStorage.clear()); await page.reload();
  ok("A1 default PET 12u 1000mm x 1000m = 16.8 kg", (await val("f-kg")) === "16.8" && (await val("f-m2")) === "1,000" && (await val("f-ft")) === "3,280.8");
  ok("A2 status 'Not connected yet'", (await status()).includes("Not connected yet"), await status());
  ok("A3 preview shows row", (await page.textContent("#s-preview")).includes("16.8 kg"), await page.textContent("#s-preview"));
  await page.screenshot({ path: SHOTS + "/save_ui_not_connected.png", fullPage: true });
  await page.click("#s-save"); await page.check("#s-auto"); await type("f-m", "2000"); await sleep(2600);
  ok("A4 Save + auto with no URL: no POSTs, still not connected", (await posts()).length === 0 && (await status()).includes("Not connected yet"));
  ok("A5 conversion still works (2000 m -> 33.6 kg)", (await val("f-kg")) === "33.6", await val("f-kg"));
  await page.uncheck("#s-auto");

  // ---- B: mock endpoint via Settings override ----
  await page.click("#s-settings summary"); await page.fill("#s-url", MOCK);
  ok("B1 status Ready after URL set", (await status()).includes("Ready"), await status());
  await page.fill("#s-user", "Nid"); await page.fill("#s-note", "Job 123");
  await type("f-m", "1000"); await sleep(300);
  await page.click("#s-save"); await sleep(700);
  let P = await posts();
  ok("B2 manual Save -> exactly 1 POST", P.length === 1, P.length);
  const b = P[0]?.json || {};
  ok("B3 POST is text/plain JSON with token", P[0]?.ctype.startsWith("text/plain") && b.token === "richmax-demo-2026", P[0]?.ctype);
  ok("B4 row fields (film)", b.tab === "Film roll / ฟิล์มม้วน" && b.preset.startsWith("PET") && b.density === 1.4 && b.thickness === 12 && b.gsm === 16.8 && b.widthMm === 1000 && b.m === 1000 && b.ft === 3280.84 && b.kg === 16.8 && b.m2 === 1000 && b.user === "Nid" && b.note === "Job 123" && b.mode === "manual" && /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(b.clientTs), JSON.stringify(b));
  ok("B5 status 'Sent'", (await status()).includes("Sent"), await status());
  await page.screenshot({ path: SHOTS + "/save_ui_sent.png", fullPage: true });
  ok("B6 name remembered in localStorage", (await page.evaluate(() => localStorage.getItem("rpuc.user"))) === "Nid");

  // ---- C: auto-send debounce ----
  await page.check("#s-auto"); await sleep(2500);
  ok("C1 enabling auto on an already-sent row sends nothing (dedupe)", (await posts()).length === 1, (await posts()).length);
  await type("f-m", "2500");           // ~4 keystrokes over ~0.5 s
  await sleep(1000);
  ok("C2 1 s after typing: nothing sent yet (status waiting)", (await posts()).length === 1 && (await status()).includes("Auto-send in"), await status());
  await page.screenshot({ path: SHOTS + "/save_ui_auto_waiting.png", fullPage: true });
  await sleep(1700); P = await posts();
  ok("C3 ~2 s stable -> exactly 1 auto POST with final value", P.length === 2 && P[1].json.m === 2500 && P[1].json.kg === 42 && P[1].json.mode === "auto", JSON.stringify(P.slice(1).map(p => [p.json.m, p.json.kg, p.json.mode])));
  // keep typing continuously for >2 s: must not send until stable
  await page.fill("#f-m", ""); for (const ch of "123456789") { await page.type("#f-m", ch); await sleep(400); }
  ok("C4 continuous typing 3.6 s -> no intermediate sends", (await posts()).length === 2);
  await sleep(2500); P = await posts();
  ok("C5 then one send with final value 123456789", P.length === 3 && P[2].json.m === 123456789, P.length);
  // same value again -> dedupe
  await type("f-m", "123456789"); await sleep(2700);
  ok("C6 re-entering identical values -> no duplicate", (await posts()).length === 3, (await posts()).length);
  // change then revert within 2 s -> equals last sent -> no send
  await type("f-m", "5"); await sleep(500); await type("f-m", "123456789"); await sleep(2700);
  ok("C7 change+revert within 2 s -> no send", (await posts()).length === 3);
  // note change alone does not trigger auto-send
  await page.fill("#s-note", "changed"); await sleep(2500);
  ok("C8 editing note alone does not auto-send", (await posts()).length === 3);

  // ---- D: paper tab auto ----
  await page.click("#tab-paper"); await sleep(200);
  ok("D0 paper default 10000 sheets 300gsm 31x43 = 2,580 kg", (await val("p-kg")) === "2,580", await val("p-kg"));
  await type("p-reams", "2"); await sleep(2700); P = await posts();
  const d = P[3]?.json || {};
  ok("D1 paper auto row", P.length === 4 && d.tab === "Sheet paper / กระดาษแผ่น" && d.sheets === 1000 && d.reams === 2 && d.gsm === 300 && d.sheetWmm === 787.4 && d.sheetHmm === 1092.2 && Math.abs(d.kg - 258) < 0.01 && d.m === "" && d.mode === "auto", JSON.stringify(d));
  ok("D2 paper UI numbers unchanged (2 reams -> 1,000 sheets, 258 kg)", (await val("p-sheets")) === "1,000" && (await val("p-kg")) === "258");
  await page.screenshot({ path: SHOTS + "/save_ui_paper_sent.png", fullPage: true });

  // ---- E: failure ----
  await page.uncheck("#s-auto");
  await page.fill("#s-url", "http://127.0.0.1:9/exec"); await page.click("#s-save"); await sleep(1500);
  ok("E1 unreachable endpoint -> 'Failed'", (await status()).includes("Failed"), await status());
  await page.screenshot({ path: SHOTS + "/save_ui_failed.png", fullPage: true });
  await page.click("#s-url-clear");
  ok("E2 clear override -> back to not connected", (await status()).includes("Not connected yet"));

  // ---- F: mobile render ----
  const m = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await m.goto(BASE); await m.screenshot({ path: SHOTS + "/save_ui_mobile.png", fullPage: true });
  const ignorable = errors.filter(e => !/ERR_CONNECTION_REFUSED|Failed to load resource|Failed to fetch/i.test(e));
  ok("G no page/console errors (excluding the intentional refused connection)", ignorable.length === 0, JSON.stringify(ignorable));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
