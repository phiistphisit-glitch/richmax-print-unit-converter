// Offline harness for Code.gs: mocks SpreadsheetApp, LockService, MailApp, Session,
// PropertiesService, Utilities, ContentService and a controllable clock.
const fs = require("fs"), vm = require("vm");
const src = fs.readFileSync(__dirname + "/Code.gs", "utf8");
let pass = 0, fail = 0;
function ok(name, cond, extra){ cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra !== undefined ? "  -> " + extra : ""}`); }

function makeEnv(opts = {}){
  let nowMs = Date.parse("2026-10-06T15:30:00Z"); // 22:30 Bangkok
  const RealDate = Date;
  class FakeDate extends RealDate { constructor(...a){ a.length ? super(...a) : super(nowMs); } static now(){ return nowMs; } }
  const rows = [], mails = [], props = {}, lockLog = [];
  const sheet = { appendRow: r => rows.push(r), getLastRow: () => rows.length, getParent: () => ({ getUrl: () => "https://docs.google.com/spreadsheets/d/TEST/edit" }) };
  const ctx = {
    Date: FakeDate, JSON, Math, String, Number, isFinite, Error,
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheets: () => [sheet], getSheetByName: () => null }) },
    LockService: { getScriptLock: () => ({ tryLock: ms => { lockLog.push("lock"); return opts.lockFails ? false : true; }, releaseLock: () => lockLog.push("release") }) },
    MailApp: { sendEmail: m => { if (opts.mailThrows) throw new Error("x"); mails.push(m); }, getRemainingDailyQuota: () => opts.quota ?? 100 },
    Session: { getEffectiveUser: () => ({ getEmail: () => "phiistphisit@gmail.com" }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperties: o => Object.assign(props, o) }) },
    Utilities: { formatDate: (d, tz, f) => {
      const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: tz, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false }).formatToParts(d).map(x => [x.type, x.value]));
      return f.replace("yyyy", p.year).replace("MM", p.month).replace("dd", p.day).replace("HH", p.hour).replace("mm", p.minute).replace("ss", p.second); } },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: t => ({ text: t, setMimeType(){ return this; } }) }
  };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  return { ctx, rows, mails, props, lockLog, tick: s => { nowMs += s * 1000; },
    post: body => JSON.parse(ctx.doPost({ postData: { contents: typeof body === "string" ? body : JSON.stringify(body) } }).text) };
}
const film = { token: "richmax-demo-2026", tab: "Film roll / ฟิล์มม้วน", preset: "PET — 12 µm · 1.40 g/cm³", density: 1.4, thickness: 12, gsm: 16.8, widthMm: 1000,
  sheetSize: "", sheetWmm: "", sheetHmm: "", m: 1000, ft: 3280.84, kg: 16.8, m2: 1000, sheets: "", reams: "", user: "Nid", note: "Job 123", mode: "manual" };
const paper = { token: "richmax-demo-2026", tab: "Sheet paper / กระดาษแผ่น", preset: "300 g/m² — Art card · อาร์ตการ์ด", density: "", thickness: "", gsm: 300, widthMm: "",
  sheetSize: "31 × 43 in (787.4 × 1,092.2 mm)", sheetWmm: 787.4, sheetHmm: 1092.2, m: "", ft: "", kg: 2579.9948, m2: 8599.983, sheets: 10000, reams: 20, user: "", note: "", mode: "auto" };

// 1. health check
let E = makeEnv();
let g = JSON.parse(E.ctx.doGet({}).text);
ok("doGet health check", g.ok === true && /^2026-10-06 22:30:00$/.test(g.time), JSON.stringify(g));
// 2. bad token / bad json
ok("bad token rejected, no row", E.post({ ...film, token: "nope" }).error === "bad_token" && E.rows.length === 0);
ok("bad JSON rejected, no row", E.post("{not json").error === "bad_json" && E.rows.length === 0);
// 3. first valid row: header + row, lock used and released
let res = E.post(film);
ok("valid post ok", res.ok === true && res.row === 2, JSON.stringify(res));
ok("header row written first", JSON.stringify(E.rows[0]) === JSON.stringify(E.ctx.HEADERS));
ok("row has 19 cols matching header", E.rows[1].length === 19 && E.ctx.HEADERS.length === 19);
ok("row timestamp is Bangkok time", E.rows[1][0] === "2026-10-06 22:30:00", E.rows[1][0]);
ok("row values in right columns", E.rows[1][1] === film.tab && E.rows[1][5] === 16.8 && E.rows[1][6] === 1000 && E.rows[1][12] === 16.8 && E.rows[1][16] === "Nid" && E.rows[1][17] === "Job 123" && E.rows[1][18] === "manual", JSON.stringify(E.rows[1]));
ok("lock acquired and released", E.lockLog.join(",") === "lock,release", E.lockLog.join(","));
// 4. email content
ok("email sent to deployer", res.email === "sent" && E.mails.length === 1 && E.mails[0].to === "phiistphisit@gmail.com");
ok("email subject format", E.mails[0].subject === "[RICHMAX Converter] Film roll / ฟิล์มม้วน - PET — 12 µm · 1.40 g/cm³: 1,000 m = 16.8 kg - 2026-10-06 22:30:00", E.mails[0].subject);
ok("email body has inputs/results/user/note/link", ["Density / ความหนาแน่น: 1.4 g/cm3", "Weight / น้ำหนัก: 16.8 kg", "User / ผู้บันทึก: Nid", "Note / หมายเหตุ: Job 123", "https://docs.google.com/spreadsheets/d/TEST/edit", "Time / เวลา (Bangkok): 2026-10-06 22:30:00"].every(s => E.mails[0].body.includes(s)));
// 5. throttle: second post 10 s later -> row logged, email throttled
E.tick(10); res = E.post(paper);
ok("2nd post within 60 s: row logged, email throttled", res.ok && E.rows.length === 3 && res.email === "throttled" && E.mails.length === 1, JSON.stringify(res));
// 6. after 60 s -> email again (paper subject)
E.tick(55); res = E.post(paper);
ok("post after 65 s: email sent", res.email === "sent" && E.mails.length === 2, JSON.stringify(res));
ok("paper subject format", E.mails[1].subject === "[RICHMAX Converter] Sheet paper / กระดาษแผ่น - 300 g/m² — Art card · อาร์ตการ์ด: 10,000 sheets = 2,579.995 kg - 2026-10-06 22:31:05", E.mails[1].subject);
ok("paper row: auto mode, sheets/reams cols", E.rows[3][18] === "auto" && E.rows[3][14] === 10000 && E.rows[3][15] === 20 && E.rows[3][10] === "");
// 7. daily cap
E = makeEnv(); E.ctx.EMAIL_DAILY_CAP = 3; let sent = 0;
for (let i = 0; i < 6; i++){ if (E.post(film).email === "sent") sent++; E.tick(61); }
ok("daily cap 3 -> only 3 emails, 6 rows", sent === 3 && E.rows.length === 7, `emails=${sent} rows=${E.rows.length - 1}`);
E.tick(24 * 3600); ok("cap resets next Bangkok day", E.post(film).email === "sent");
// 8. EMAIL_ON_AUTO=false
E = makeEnv(); E.ctx.EMAIL_ON_AUTO = false;
ok("EMAIL_ON_AUTO=false: auto row logged, no email", E.post(paper).email === "skipped_auto" && E.mails.length === 0 && E.rows.length === 2);
ok("EMAIL_ON_AUTO=false: manual still emails", E.post(film).email === "sent");
// 9. NOTIFY_EMAIL override, EMAIL_ENABLED=false
E = makeEnv(); E.ctx.NOTIFY_EMAIL = "someone@example.com"; E.post(film);
ok("NOTIFY_EMAIL override used", E.mails[0].to === "someone@example.com");
E = makeEnv(); E.ctx.EMAIL_ENABLED = false;
ok("EMAIL_ENABLED=false: row only", E.post(film).email === "disabled" && E.rows.length === 2 && E.mails.length === 0);
// 10. quota exhausted / mail error / lock busy
E = makeEnv({ quota: 0 }); ok("MailApp quota 0 -> skipped, row logged", E.post(film).email === "quota" && E.rows.length === 2);
E = makeEnv({ mailThrows: true }); res = E.post(film); ok("mail error -> row still logged, ok:true", res.ok && res.email === "error" && E.rows.length === 2);
E = makeEnv({ lockFails: true }); ok("lock busy -> no row", E.post(film).error === "busy" && E.rows.length === 0);
// 11. formula injection + junk numbers
E = makeEnv(); E.post({ ...film, user: "=HYPERLINK(\"x\")", note: "+cmd", kg: "abc" });
ok("formula injection escaped, bad number blank", E.rows[1][16] === "'=HYPERLINK(\"x\")" && E.rows[1][17] === "'+cmd" && E.rows[1][12] === "", JSON.stringify(E.rows[1].slice(12, 18)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
