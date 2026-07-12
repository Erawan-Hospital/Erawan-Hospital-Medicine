/**
 * Google Apps Script — Web App backend for "ระบบแจ้งเตือนยาใกล้หมดอายุและคลังยา"
 * ────────────────────────────────────────────────────────────────────────────
 * Deploy this bound to your Google Sheet, then put the /exec URL into the
 * Vercel env var SHEET_ENDPOINT. The website reads it through /api/data.
 *
 * HOW TO DEPLOY (one time):
 *   1. Open your Google Sheet → Extensions → Apps Script.
 *   2. Delete any code, paste THIS file, Save.
 *   3. Deploy → New deployment → type "Web app".
 *        - Execute as: Me
 *        - Who has access: Anyone
 *   4. Copy the Web app URL (ends with /exec). That is your SHEET_ENDPOINT.
 *
 * The sheet stays private — only this script (running as you) can read it.
 *
 * EXPECTED TABS (rename in TAB_ALIASES if yours differ):
 *   • Medicines  — one row per drug lot in stock
 *   • Receiving  — history of stock coming in
 *   • Dispensing — history of stock going out
 *   • Users      — login accounts (optional; falls back to built-in admin/staff)
 *
 * The first row of each tab must be the column headers. Header names are matched
 * loosely (Thai or English) via the alias tables below — add your own if needed.
 */

// ---- Which sheet tab satisfies each role (first match wins, case-insensitive) ----
var TAB_ALIASES = {
  medicines:  ['medicines', 'ยา', 'คลังยา', 'รายการยา', 'stock', 'ยาคงเหลือ'],
  receiving:  ['receiving', 'รับเข้า', 'ประวัติการรับเข้า', 'ประวัติการรับเข้ายา', 'รับยา'],
  dispensing: ['dispensing', 'ส่งออก', 'จ่ายออก', 'ประวัติการส่งออก', 'ประวัติการส่งออกยา', 'จ่ายยา'],
  users:      ['users', 'ผู้ใช้', 'ผู้ใช้งาน', 'บัญชีผู้ใช้', 'accounts']
};

// ---- Column header aliases per field ----
var FIELD_ALIASES = {
  medicines: {
    code:      ['code', 'รหัสยา', 'รหัส', 'drug code', 'item code'],
    name:      ['name', 'ชื่อยา', 'ชื่อ', 'ชื่อรายการ', 'drug name', 'item'],
    unit:      ['unit', 'หน่วย', 'หน่วยนับ'],
    warehouse: ['warehouse', 'คลัง', 'คลังยา', 'ชื่อคลัง', 'location', 'สถานที่'],
    lot:       ['lot', 'ล็อต', 'เลขล็อต', 'lot no', 'lot number', 'batch'],
    expiry:    ['expiry', 'expiry date', 'วันหมดอายุ', 'วันที่หมดอายุ', 'หมดอายุ', 'exp', 'expire'],
    qty:       ['qty', 'quantity', 'คงเหลือ', 'จำนวน', 'จำนวนคงเหลือ', 'คงเหลือรวม', 'stock']
  },
  logs: {
    date:   ['date', 'วันที่', 'วันที่รับเข้า', 'วันที่ส่งออก', 'วันที่จ่าย', 'วันที่จ่ายออก'],
    time:   ['time', 'เวลา'],
    name:   ['name', 'ชื่อยา', 'ชื่อ'],
    unit:   ['unit', 'หน่วย', 'หน่วยนับ'],
    qty:    ['qty', 'quantity', 'จำนวน', 'จำนวนรับเข้า', 'จำนวนส่งออก', 'จำนวนจ่ายออก'],
    lot:    ['lot', 'ล็อต', 'เลขล็อต', 'lot no'],
    expiry: ['expiry', 'expiry date', 'วันหมดอายุ', 'วันที่หมดอายุ', 'หมดอายุ', 'exp', 'expire'],
    person: ['person', 'ผู้รับเข้า', 'ผู้ส่งออก', 'ผู้จ่ายออก', 'ผู้ทำรายการ', 'ผู้บันทึก', 'โดย'],
    place:  ['place', 'แหล่งที่มา', 'รับเข้าจาก', 'ส่งออกไปที่', 'จ่ายออกไปที่', 'ปลายทาง', 'ต้นทาง', 'from', 'to']
  },
  users: {
    name:     ['name', 'ชื่อ', 'ชื่อผู้ใช้', 'ชื่อ-สกุล', 'ชื่อ-นามสกุล'],
    username: ['username', 'ชื่อผู้ใช้งาน', 'user', 'ยูสเซอร์เนม'],
    password: ['password', 'รหัสผ่าน', 'pass'],
    role:     ['role', 'สิทธิ์', 'บทบาท', 'ตำแหน่ง']
  }
};

function doGet() {
  var out;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var tz = ss.getSpreadsheetTimeZone() || 'Asia/Bangkok';

    out = {
      ok: true,
      syncedAt: new Date().toISOString(),
      medicines:  readTab_(ss, 'medicines', FIELD_ALIASES.medicines, tz),
      receiving:  readTab_(ss, 'receiving', FIELD_ALIASES.logs, tz),
      dispensing: readTab_(ss, 'dispensing', FIELD_ALIASES.logs, tz),
      users:      readTab_(ss, 'users', FIELD_ALIASES.users, tz)
    };
  } catch (err) {
    out = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function findSheet_(ss, role) {
  var aliases = TAB_ALIASES[role].map(function (a) { return a.toLowerCase(); });
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (aliases.indexOf(sheets[i].getName().trim().toLowerCase()) !== -1) return sheets[i];
  }
  return null;
}

function readTab_(ss, role, fieldMap, tz) {
  var sheet = findSheet_(ss, role);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  var header = values[0].map(function (h) { return String(h).trim().toLowerCase(); });

  // Resolve each canonical field -> column index using the alias list.
  var colOf = {};
  Object.keys(fieldMap).forEach(function (field) {
    var aliases = fieldMap[field];
    for (var a = 0; a < aliases.length; a++) {
      var idx = header.indexOf(aliases[a].toLowerCase());
      if (idx !== -1) { colOf[field] = idx; break; }
    }
  });

  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var obj = {};
    var empty = true;
    Object.keys(colOf).forEach(function (field) {
      var v = row[colOf[field]];
      if (v instanceof Date) {
        // date-only for expiry/date fields, else ISO
        v = Utilities.formatDate(v, tz, (field === 'time') ? 'HH:mm' : 'yyyy-MM-dd');
      } else {
        v = (v === null || v === undefined) ? '' : String(v).trim();
      }
      if (v !== '') empty = false;
      obj[field] = v;
    });
    if (!empty) rows.push(obj);
  }
  return rows;
}
