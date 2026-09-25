/* api.js — front-end-only demo layer for the DIMS prototype.
   No server needed: sample data lives in the browser (localStorage) and the pages
   call apiFetch() exactly as they would call a real API later.
   Keep this file in the same folder as the HTML pages. */

// ── Presentation switch ──────────────────────
// true  = sample coaches, sample accounts and prefilled readings (for the stakeholder demo)
// false = clean start: only one SSE / HOD account (SSE-1001 / demo123) and no coaches
// Changing this value automatically resets each browser's stored data the next time a page loads.
const DEMO_DATA = true;

const API = "/api";                              // fake base path, kept so page code reads like real API calls
const LOGIN_PAGE = "login.html";
const MGMT_HOME  = "sse-hod-summary.html";       // SSE / HOD landing page
const IS_HOME    = "is-summary.html";              // Inspection Staff landing page (table layout — finalized)

const _DB_KEY = "dims_demo_db", _SESSION_KEY = "dims_demo_user";
const _TYPE_LABEL = { LHB: "LHB", NEW_LHB: "New LHB", THERMAL_LHB: "Thermal LHB", THERMAL_SG: "Thermal SG" };

// ── Form schema, mission-critical watchlist and flagged (out-of-range) detection ──
// Shared by is-main-entry.html, critical-parameters.html and the executive dashboard.
// section/index locate a field within is-main-entry's own section/field order.
const SECTION_NAMES = [
  "Contactor load test", "Insulation resistance test", "Equipment health checklist", "Detailed technical verification",
  "Modification tracking log", "Pre-cooling performance test", "Power car / DG-set", "Earthing & deficiency declaration"
];
const FORM_FIELDS = [
  ["Pump 1.1", "Compressor 1.1", "Blower motor 1.1", "Compressor 1.2", "RBC contactor", "Heater PP 2.1"],
  ["750V circuit", "415V circuit", "230V circuit", "110V circuit", "24V circuit"],
  ["MMR", "Contactors", "Deep freezer", "Return filter", "Tube light (S)", "Earthing"],
  ["HP cut-out, PP side", "LP cut-out, NPP side", "Earthing device", "Power panel make", "EBC cum RBC"],
  ["Blower heater modification", "200VA transformer modification", "Rodent protection (mouse plate)"],
  ["Rotary switch position", "Coach temp at cut-in", "Coach temp at cut-out", "Time taken"],
  ["Make of DG set, Set A", "Diesel tank status, Set A", "Battery cell-end connections, Set A"],
  ["Shut-off valve / live terminal", "Any other deficiency"]
];

// Mission-critical: a fixed watchlist SSE/HOD always want visibility on, whatever the reading is.
const MISSION_CRITICAL_PARAMS = [
  { section: 1, index: 0, sub: "" },
  { section: 3, index: 0, sub: "" },
  { section: 3, index: 1, sub: "" },
  { section: 3, index: 2, sub: "" },
  { section: 3, index: 4, sub: "" },
  { section: 0, index: 4, sub: "K-30" },
  { section: 7, index: 0, sub: "" }
].map(p => ({ ...p, label: FORM_FIELDS[p.section][p.index], sectionName: SECTION_NAMES[p.section] }));

// Flagged: any parameter — mission-critical or not — whose entered value is outside its defined
// range. Minimum thresholds exist today only for the insulation-resistance readings; every other
// field without a defined range is "unrated" (recorded, but nothing to check it against yet).
const MIN_SPEC = { "1-0": 5, "1-1": 3, "1-2": 2, "1-3": 2, "1-4": 1 };            // section-index -> minimum MΩ
const GOOD_SELECT_VALUES = new Set(["OK", "Earthed", "Working", "Full", "Disconnected"]);
const BAD_SELECT_VALUES  = new Set(["Not OK", "Not earthed", "Not working", "Empty", "Not disconnected"]);

function paramState(section, index, value) {   // "pending" | "flagged" | "ok" | "unrated"
  if (!value) return "pending";
  const key = section + "-" + index;
  if (key in MIN_SPEC) { const n = parseFloat(value); return (!isNaN(n) && n < MIN_SPEC[key]) ? "flagged" : "ok"; }
  if (BAD_SELECT_VALUES.has(value)) return "flagged";
  if (GOOD_SELECT_VALUES.has(value)) return "ok";
  return "unrated";
}

// Sample values for the seeded demo coach (04512, visit id 1) only, so the mission-critical and
// flagged views have something to show before anyone opens and saves the entry form. Its RBC
// contactor reading is deliberately left blank, matching the entry page's own demo fill.
const DEMO_ENTRY = {
  0: { "Pump 1.1": "4.2", "Compressor 1.1": "11.8", "Blower motor 1.1": "3.6", "Compressor 1.2": "12.1", "Heater PP 2.1": "9.4" },
  1: { "750V circuit": "3.1", "415V circuit": "4.8", "230V circuit": "3.2", "110V circuit": "2.6", "24V circuit": "1.9" },
  2: { "MMR": "OK", "Contactors": "OK", "Deep freezer": "OK", "Return filter": "OK", "Tube light (S)": "OK", "Earthing": "OK" },
  3: { "HP cut-out, PP side": "OK", "LP cut-out, NPP side": "Not OK", "Earthing device": "Earthed", "Power panel make": "Medha", "EBC cum RBC": "Working" },
  4: { "Blower heater modification": "Already done", "200VA transformer modification": "Already done", "Rodent protection (mouse plate)": "To be done" },
  5: { "Rotary switch position": "3", "Coach temp at cut-in": "34", "Coach temp at cut-out": "24", "Time taken": "42" },
  6: { "Make of DG set, Set A": "Cummins", "Diesel tank status, Set A": "Full", "Battery cell-end connections, Set A": "Disconnected" },
  7: { "Shut-off valve / live terminal": "Earthed", "Any other deficiency": "None noted" }
};
function demoEntryFor(visitId) {
  if (!DEMO_DATA || visitId !== 1) return null;
  return FORM_FIELDS.map((fields, si) => fields.map(label => DEMO_ENTRY[si][label] || ""));
}
function effectiveEntry(visit) { return (visit && visit.entry) || demoEntryFor(visit && visit.id); }

function missionCriticalValues(visit) {
  const entry = effectiveEntry(visit);
  return MISSION_CRITICAL_PARAMS.map(p => {
    const value = (entry && entry[p.section] && entry[p.section][p.index]) || "";
    return { ...p, value, state: paramState(p.section, p.index, value) };
  });
}
function flaggedValues(visit) {   // every out-of-range parameter, mission-critical or not
  const entry = effectiveEntry(visit);
  if (!entry) return [];
  const mcKeys = new Set(MISSION_CRITICAL_PARAMS.map(p => p.section + "-" + p.index));
  const out = [];
  FORM_FIELDS.forEach((fields, si) => fields.forEach((label, fi) => {
    if (label === "Any other deficiency") return;   // free text, not a monitored reading
    const value = (entry[si] && entry[si][fi]) || "";
    if (paramState(si, fi, value) === "flagged")
      out.push({ section: si, index: fi, label, sectionName: SECTION_NAMES[si], sub: "", value, isMissionCritical: mcKeys.has(si + "-" + fi) });
  }));
  return out;
}


// ── Sample data ──────────────────────────────
function _seed() {
  const ago = m => new Date(Date.now() - m * 60000).toISOString();
  const v = (id, no, uid, name, type, status, flagged, done, saved, sub) => ({
    id, coach_number: no, assigned_to: uid, assigned_to_name: name, coach_type: type, status,
    flagged_count: flagged, sections_completed: done, sections_total: 8,
    last_saved_on: saved === null ? null : ago(saved), submitted_on: sub ? ago(sub) : null
  });
  const u = (id, login, name, mgmt) => ({ id, login_id: login, full_name: name, email: login.toLowerCase() + "@example.com", password: "demo123", is_mgmt_staff: mgmt });
  if (!DEMO_DATA) return { demo: false, nextUserId: 6, nextVisitId: 1, users: [u(5, "SSE-1001", "M.S. Dhoni", true)], visits: [] };
  return {
    demo: true, nextUserId: 6, nextVisitId: 7,
    users: [u(1, "IS-1001", "R. Sharma", false), u(2, "AV-3101", "A. Verma", false), u(3, "KN-2207", "K. Nair", false),
            u(4, "SI-2210", "S. Iyer", false), u(5, "SSE-1001", "M.S. Dhoni", true)],
    visits: [
      v(1, "04512", 1, "R. Sharma", "LHB", "IN_PROGRESS", 6, 3, 2),
      v(2, "04513", 2, "A. Verma", "NEW_LHB", "IN_PROGRESS", 0, 1, 18),
      v(3, "04498", 4, "S. Iyer", "THERMAL_LHB", "SUBMITTED", 2, 8, 60, 60),
      v(4, "04501", 3, "K. Nair", "THERMAL_SG", "IN_PROGRESS", 0, 5, 40),
      v(5, "04487", 1, "R. Sharma", "LHB", "SUBMITTED", 0, 8, 1440, 1440),
      v(6, "04520", 1, "R. Sharma", "NEW_LHB", "ASSIGNED", 0, 0, null)
    ]
  };
}
function _db() {
  try { const d = JSON.parse(localStorage.getItem(_DB_KEY)); if (d && d.demo === DEMO_DATA) return d; } catch (e) {}   // stale data from the other mode is replaced
  const d = _seed(); _save(d); return d;
}
function _save(d) { localStorage.setItem(_DB_KEY, JSON.stringify(d)); }
function resetDemo() { localStorage.removeItem(_DB_KEY); sessionStorage.removeItem(_SESSION_KEY); }
const _pub = u => u && { id: u.id, login_id: u.login_id, full_name: u.full_name, is_mgmt_staff: u.is_mgmt_staff };

// ── Session ──────────────────────────────────
async function authenticate(loginId, password) {
  const u = _db().users.find(x => x.login_id.toLowerCase() === loginId.toLowerCase());
  if (!u || u.password !== password) throw new Error("Login ID or password is incorrect.");
  sessionStorage.setItem(_SESSION_KEY, String(u.id));
  return _pub(u);
}
function getUser() { const id = +sessionStorage.getItem(_SESSION_KEY); return _pub(_db().users.find(x => x.id === id)) || null; }
function logout() { clearSession(); location.href = LOGIN_PAGE; }
function requireAuth() {
  if (getUser()) return;
  if (!DEMO_DATA) { location.replace(LOGIN_PAGE); return; }
  // Demo convenience: a page opened directly still shows data, using that page's default demo account
  sessionStorage.setItem(_SESSION_KEY, /sse-hod/.test(location.pathname) ? "5" : "1");
}
function clearSession() { sessionStorage.removeItem(_SESSION_KEY); }

// ── Mock API (same shape the real Django API will have later) ──
function _res(body, ok = true) { return Promise.resolve({ ok, status: ok ? 200 : 400, json: async () => body }); }

async function apiFetch(url, opts = {}) {
  const me = getUser(), db = _db(), method = opts.method || "GET";
  const body = opts.body ? JSON.parse(opts.body) : {};

  if (/\/visits\/$/.test(url)) {
    if (method === "GET") return _res(db.visits.filter(v => me && (me.is_mgmt_staff || v.assigned_to === me.id)));
    const staff = db.users.find(x => x.id === body.assigned_to && !x.is_mgmt_staff);
    if (!staff) return _res({ assigned_to: ["Select a valid inspection staff member."] }, false);
    db.visits.unshift({
      id: db.nextVisitId++, coach_number: body.coach_number, assigned_to: staff.id, assigned_to_name: staff.full_name,
      coach_type: body.coach_type, status: "ASSIGNED", flagged_count: 0, sections_completed: 0, sections_total: 8,
      last_saved_on: null, submitted_on: null
    });
    _save(db); return _res({ ok: true });
  }
  if (/\/users\/$/.test(url)) {
    if (method === "GET") return _res(db.users.filter(x => !x.is_mgmt_staff).map(_pub));
    if (db.users.some(x => x.login_id.toLowerCase() === body.staff_id.toLowerCase()))
      return _res({ staff_id: ["A user with this staff ID already exists."] }, false);
    if (db.users.some(x => x.email === body.staff_email_id))
      return _res({ staff_email_id: ["A user with this email already exists."] }, false);
    db.users.push({ id: db.nextUserId++, login_id: body.staff_id, full_name: body.staff_id, email: body.staff_email_id, password: body.password, is_mgmt_staff: false });
    _save(db); return _res({ ok: true });
  }
  return _res({}, false);
}

function getVisit(id) { const v = _db().visits.find(x => x.id === +id); return v ? { ...v } : null; }
function saveVisitProgress(id, done, entry) {          // done = number of complete sections, entry = the values typed in
  const db = _db(), v = db.visits.find(x => x.id === +id);
  if (!v || v.status === "SUBMITTED") return;
  v.status = "IN_PROGRESS"; v.sections_completed = done; v.last_saved_on = new Date().toISOString();
  if (entry) v.entry = entry;
  _save(db);
}
// Used by the inspection entry page's Submit button: submitVisit(id)
function submitVisit(id, done, entry) {
  const db = _db(), v = db.visits.find(x => x.id === +id);
  if (!v) return;
  v.status = "SUBMITTED"; v.sections_completed = done ?? v.sections_total;
  if (entry) v.entry = entry;
  v.last_saved_on = v.submitted_on = new Date().toISOString();
  _save(db);
}

// ── Export file naming: {coach_no}_{functionality}_{date_of_export} ──
// coachNo may be an actual coach number ("04512") or a page-level label ("all-coaches")
// when the export covers more than one coach. Date is DDMMYYYY, the export day.
function exportFileBase(coachNo, func) {
  const d = new Date(), pad = n => String(n).padStart(2, "0");
  return `${coachNo}_${func}_${pad(d.getDate())}${pad(d.getMonth() + 1)}${d.getFullYear()}`;
}

// ── Export (real files, generated in the browser) ──
// Shared by the SSE/HOD summary and the inspection entry page.
// format: "csv" | "excel" | "pdf"; base = file name without extension; title = heading used on the PDF
function exportRows(base, title, head, rows, format) {
  const save = (blob, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); };
  const csv = () => save(new Blob([[head, ...rows].map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(",")).join("\r\n")], { type: "text/csv" }), base + ".csv");

  if (format === "csv") return csv();
  if (format === "pdf") {
    const w = window.open("", "_blank");
    if (!w) return showToast("Allow pop-ups to export the PDF.", "error");
    w.document.write(`<title>${esc(title)}</title><style>body{font-family:sans-serif;padding:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:7px 10px;text-align:left;font-size:13px}th{background:#eef1f3}</style>
      <h2>${esc(title)}</h2>
      <table><tr>${head.map(h => `<th>${esc(h)}</th>`).join("")}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
    return;
  }
  // Excel: real .xlsx via SheetJS (needs internet once); falls back to CSV
  const make = () => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([head, ...rows]), "Sheet1"); XLSX.writeFile(wb, base + ".xlsx"); };
  if (window.XLSX) return make();
  const sc = document.createElement("script");
  sc.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
  sc.onload = make;
  sc.onerror = () => { showToast("Excel export needs an internet connection — saved as CSV instead.", "error"); csv(); };
  document.head.appendChild(sc);
}

function demoExport(format) {   // SSE/HOD summary table — covers every visible coach, so there's no single coach number
  const db = _db(), me = getUser();
  const rows = db.visits.filter(v => me && (me.is_mgmt_staff || v.assigned_to === me.id))
    .map(v => [v.coach_number, v.assigned_to_name, _TYPE_LABEL[v.coach_type] || v.coach_type,
      v.status === "SUBMITTED" ? "Submitted" : v.status === "ASSIGNED" ? "Not started" : "In progress",
      v.flagged_count, v.last_saved_on ? fmtDateTime(v.last_saved_on) : "—"]);
  const head = ["Coach", "Inspection staff", "Type", "Status", "Flagged params", "Last saved"];
  exportRows(exportFileBase("all-coaches", "live-inspections"), "Live inspections — " + new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }), head, rows, format);
}

// ── Small UI helpers ─────────────────────────
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmtDateTime(t) {
  return t ? new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
}
function showToast(msg, type) {
  let el = document.getElementById("dimsToast");
  if (!el) {
    el = document.createElement("div");
    el.id = "dimsToast";
    el.setAttribute("role", "status");
    el.style.cssText = "position:fixed;bottom:24px;right:24px;color:#fff;padding:11px 18px;border-radius:8px;font:500 13.5px 'Outfit',sans-serif;z-index:300;max-width:360px;box-shadow:0 6px 20px rgba(18,42,68,.25)";
    document.body.appendChild(el);
  }
  el.style.background = type === "error" ? "#9C2B1F" : "#122A44";
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.display = "none"; }, 3200);
}
