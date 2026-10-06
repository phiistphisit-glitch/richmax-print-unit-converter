/**
 * RICHMAX Print Unit Converter — Team Log (Google Apps Script web app)
 * Bound to the Google Sheet "RICHMAX Print Unit Converter - Team Log".
 *
 * doPost : appends one row per calculation (LockService + shared token), then sends a
 *          throttled email notification with MailApp.
 * doGet  : health check (open the Web App URL in a browser -> {"ok":true,...}).
 *
 * NOTE: SHARED_TOKEN is also in the PUBLIC web page, so it is a demo-level filter
 *       against random traffic, not a real secret.
 */

// ===== Settings (edit here) =====
var SHARED_TOKEN = 'richmax-demo-2026';   // must match SHEETS_TOKEN in index.html
var SHEET_NAME = '';                      // '' = first tab of this spreadsheet
var TZ = 'Asia/Bangkok';

var EMAIL_ENABLED = true;                 // master switch for notifications
var NOTIFY_EMAIL = '';                    // '' = the Google account that deployed the script (Session.getEffectiveUser())
var EMAIL_ON_AUTO = true;                 // also email for rows that came from "Auto-send"
var EMAIL_MIN_INTERVAL_SEC = 60;          // at most 1 email per 60 s (rows are always logged)
var EMAIL_DAILY_CAP = 50;                 // at most 50 emails per Bangkok day (Gmail quota is ~100/day)

var HEADERS = ['Timestamp (Asia/Bangkok)', 'Tab', 'Preset', 'Density (g/cm3)', 'Thickness (um)', 'GSM (g/m2)',
  'Width (mm)', 'Sheet size', 'Sheet W (mm)', 'Sheet H (mm)', 'Meters (m)', 'Feet (ft)', 'Weight (kg)',
  'Area (m2)', 'Sheets', 'Reams (500)', 'User', 'Note', 'Send mode'];

// ===== Web app entry points =====
function doGet(e) {
  return json_({ ok: true, service: 'RICHMAX Print Unit Converter - Team Log', time: nowText_() });
}

function doPost(e) {
  var data;
  try {
    data = JSON.parse((e && e.postData && e.postData.contents) || '');
  } catch (err) {
    return json_({ ok: false, error: 'bad_json' });
  }
  if (!data || data.token !== SHARED_TOKEN) return json_({ ok: false, error: 'bad_token' });

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return json_({ ok: false, error: 'busy' });

  var sheet, ts, row, rowNumber, mailDecision;
  try {
    sheet = getSheet_();
    if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
    ts = nowText_();
    row = buildRow_(data, ts);
    sheet.appendRow(row);
    rowNumber = sheet.getLastRow();
    mailDecision = decideEmail_(data);          // throttle state is updated inside the lock
  } finally {
    lock.releaseLock();
  }

  var email = mailDecision;
  if (mailDecision === 'send') {
    try {
      sendEmail_(data, ts, sheet);
      email = 'sent';
    } catch (err) {
      email = 'error';
    }
  }
  return json_({ ok: true, row: rowNumber, email: email });
}

// ===== Helpers =====
function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return (SHEET_NAME && ss.getSheetByName(SHEET_NAME)) || ss.getSheets()[0];
}

function nowText_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');
}

// Text cells: trim, cap length, and stop spreadsheet formulas (=, +, -, @) being injected.
function txt_(v, max) {
  var s = String(v == null ? '' : v).trim().slice(0, max || 200);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
// Number cells: numbers only, otherwise blank.
function num_(v) {
  if (v === '' || v == null) return '';
  var n = Number(v);
  return isFinite(n) ? n : '';
}

function buildRow_(d, ts) {
  return [ts, txt_(d.tab, 40), txt_(d.preset, 80), num_(d.density), num_(d.thickness), num_(d.gsm),
    num_(d.widthMm), txt_(d.sheetSize, 60), num_(d.sheetWmm), num_(d.sheetHmm),
    num_(d.m), num_(d.ft), num_(d.kg), num_(d.m2), num_(d.sheets), num_(d.reams),
    txt_(d.user, 60), txt_(d.note, 300), d.mode === 'auto' ? 'auto' : 'manual'];
}

// Returns 'send' or a reason it was skipped. Rows are logged either way.
function decideEmail_(d) {
  if (!EMAIL_ENABLED) return 'disabled';
  if (d.mode === 'auto' && !EMAIL_ON_AUTO) return 'skipped_auto';
  var props = PropertiesService.getScriptProperties();
  var nowMs = new Date().getTime();
  var today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  var last = Number(props.getProperty('email_last_ms') || 0);
  var day = props.getProperty('email_day') || '';
  var count = day === today ? Number(props.getProperty('email_count') || 0) : 0;
  if (nowMs - last < EMAIL_MIN_INTERVAL_SEC * 1000) return 'throttled';
  if (count >= EMAIL_DAILY_CAP) return 'daily_cap';
  if (MailApp.getRemainingDailyQuota() < 1) return 'quota';
  props.setProperties({ email_last_ms: String(nowMs), email_day: today, email_count: String(count + 1) });
  return 'send';
}

function fmtN_(v, dp) {
  if (v === '' || v == null || !isFinite(Number(v))) return '-';
  var p = Math.pow(10, dp == null ? 3 : dp);
  var s = String(Math.round(Number(v) * p) / p).split('.');
  return s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (s[1] ? '.' + s[1] : '');
}

function sendEmail_(d, ts, sheet) {
  var to = NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();
  if (!to) throw new Error('no recipient');
  var film = String(d.tab || '').indexOf('Film') === 0;
  var key = film
    ? fmtN_(d.m) + ' m = ' + fmtN_(d.kg) + ' kg'
    : fmtN_(d.sheets, 2) + ' sheets = ' + fmtN_(d.kg) + ' kg';
  var subject = '[RICHMAX Converter] ' + (film ? 'Film roll / ฟิล์มม้วน' : 'Sheet paper / กระดาษแผ่น') +
    ' - ' + txt_(d.preset, 60) + ': ' + key + ' - ' + ts;
  var lines = [
    'RICHMAX Print Unit Converter - new row / มีการบันทึกรายการใหม่',
    '',
    'Time / เวลา (Bangkok): ' + ts,
    'Tab / แท็บ: ' + txt_(d.tab, 40),
    'Mode / วิธีส่ง: ' + (d.mode === 'auto' ? 'Auto-send / อัตโนมัติ' : 'Manual / กดบันทึกเอง'),
    'User / ผู้บันทึก: ' + (txt_(d.user, 60) || '-'),
    'Note / หมายเหตุ: ' + (txt_(d.note, 300) || '-'),
    '',
    '--- Inputs / ค่าที่กรอก ---',
    'Preset / วัสดุ: ' + txt_(d.preset, 80)
  ];
  if (film) {
    lines.push('Density / ความหนาแน่น: ' + fmtN_(d.density) + ' g/cm3',
      'Thickness / ความหนา: ' + fmtN_(d.thickness, 2) + ' um',
      'GSM: ' + fmtN_(d.gsm) + ' g/m2',
      'Web width / หน้ากว้าง: ' + fmtN_(d.widthMm, 1) + ' mm',
      '', '--- Results / ผลการคำนวณ ---',
      'Length / ความยาว: ' + fmtN_(d.m) + ' m',
      'Length / ความยาว: ' + fmtN_(d.ft, 2) + ' ft',
      'Weight / น้ำหนัก: ' + fmtN_(d.kg, 4) + ' kg',
      'Area / พื้นที่: ' + fmtN_(d.m2) + ' m2');
  } else {
    lines.push('GSM: ' + fmtN_(d.gsm, 2) + ' g/m2',
      'Sheet size / ขนาดแผ่น: ' + txt_(d.sheetSize, 60) + ' (' + fmtN_(d.sheetWmm, 1) + ' x ' + fmtN_(d.sheetHmm, 1) + ' mm)',
      '', '--- Results / ผลการคำนวณ ---',
      'Sheets / จำนวนแผ่น: ' + fmtN_(d.sheets, 2),
      'Weight / น้ำหนัก: ' + fmtN_(d.kg, 4) + ' kg',
      'Reams (500) / รีม: ' + fmtN_(d.reams, 4),
      'Area / พื้นที่: ' + fmtN_(d.m2) + ' m2');
  }
  lines.push('', 'Theoretical values; exclude cores, waste and moisture. / ค่าทางทฤษฎี ไม่รวมแกน ของเสีย และความชื้น',
    '', 'Open the Sheet / เปิดชีต: ' + sheet.getParent().getUrl());
  MailApp.sendEmail({ to: to, subject: subject, body: lines.join('\n'), name: 'RICHMAX Converter' });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
