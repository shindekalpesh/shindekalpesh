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
const LOGIN_PAGE = "index.html";
const MGMT_HOME  = "executive-dashboard.html";   // Management (MG-xxxx) landing page — read-only
const SSE_HOME   = "sse-hod-summary.html";       // SSE / HOD landing page
const IS_HOME    = "is-summary.html";            // Inspection Staff landing page

const _DB_KEY = "dims_demo_db", _SESSION_KEY = "dims_demo_user";
const _SCHEMA = 4;   // bump when the stored data shape changes, so every browser reseeds on its next page load
const _TYPE_LABEL = { LHB_NON_AC: "LHB Non-AC", LHB_AC: "LHB AC", ICF_NON_AC: "ICF Non-AC", ICF_AC: "ICF AC" };

// Staff role constants
const ROLE_IS  = "IS";   // Inspection Staff — one section + one inspection stage
const ROLE_SSE = "SSE";  // SSE / HOD — one section, no stage
const ROLE_MG  = "MG";   // Management — no section, no stage; read-only executive view

// Inspection stages
const STAGE_PRE   = "pre_inspection";
const STAGE_POH   = "poh_or_modification";
const STAGE_FINAL = "final_inspection";

// ── Form schema for TL LHB Non-AC ────────────
// Pre-inspection sections and fields
const SECTION_NAMES_PRE = [
  "Contactor load test", "Insulation resistance test", "Equipment health checklist",
  "Detailed technical verification", "Modification tracking log",
  "Pre-cooling performance test", "Power car / DG-set", "Earthing & deficiency declaration"
];
const FORM_FIELDS_PRE = [
  ["Pump 1.1", "Compressor 1.1", "Blower motor 1.1", "Compressor 1.2", "RBC contactor", "Heater PP 2.1"],
  ["750V circuit", "415V circuit", "230V circuit", "110V circuit", "24V circuit"],
  ["MMR", "Contactors", "Deep freezer", "Return filter", "Tube light (S)", "Earthing"],
  ["HP cut-out, PP side", "LP cut-out, NPP side", "Earthing device", "Power panel make", "EBC cum RBC"],
  ["Blower heater modification", "200VA transformer modification", "Rodent protection (mouse plate)"],
  ["Rotary switch position", "Coach temp at cut-in", "Coach temp at cut-out", "Time taken"],
  ["Make of DG set, Set A", "Diesel tank status, Set A", "Battery cell-end connections, Set A"],
  ["Shut-off valve / live terminal", "Any other deficiency"]
];

// POH / Modification sections and fields
const SECTION_NAMES_POH = [
  "CAI Modification items", "Overhauled components", "Fitments & replacements",
  "Electrical systems check", "Mechanical systems check", "Remarks"
];
const FORM_FIELDS_POH = [
  ["Blower heater modification", "200VA transformer modification", "Rodent protection (mouse plate)",
   "Earthing modification", "MMR replacement", "Contactor overhaul", "Return filter replacement",
   "Deep freezer service", "Tube light replacement", "Battery cell replacement",
   "DG set service (Set A)", "DG set service (Set B)", "Rotary switch replacement",
   "HP cut-out calibration", "LP cut-out calibration", "EBC/RBC servicing", "Power panel refurbishment"],
  ["Compressor (1.1)", "Compressor (1.2)", "Blower motor (1.1)", "Pump (1.1)"],
  ["PP wiring", "NPP wiring", "Earth bonding", "Roof insulation"],
  ["750V bus check", "415V bus check", "230V circuit", "110V circuit", "24V circuit"],
  ["Bogie inspection", "Coupler check", "Buffer check", "Door mechanism"],
  ["Remarks / observations"]
];

// Final inspection sections and fields
const SECTION_NAMES_FINAL = [
  "Visual inspection", "Functional tests", "Safety checks",
  "Measurement & readings", "Equipment replaced log", "Sign-off"
];
const FORM_FIELDS_FINAL = [
  ["Coach body condition", "Roof condition", "Floor condition", "Window condition", "Door condition"],
  ["AC cooling performance", "Lighting functional", "Fan operation", "PA system", "Emergency lighting"],
  ["Fire extinguisher", "Emergency exit", "Earthing verified", "Live terminal check", "Shut-off valve"],
  ["Final IR (750V)", "Final IR (415V)", "Final IR (230V)", "AC cut-in temp", "AC cut-out temp"],
  ["Items replaced (list)"],
  ["Final remarks", "Inspector sign-off"]
];

// Aliases so existing pages that reference SECTION_NAMES / FORM_FIELDS keep working
const SECTION_NAMES = SECTION_NAMES_PRE;
const FORM_FIELDS   = FORM_FIELDS_PRE;

// Stage labels and section counts, shared by every page
const STAGE_LABEL    = { [STAGE_PRE]: "Pre-inspection", [STAGE_POH]: "POH / Modification", [STAGE_FINAL]: "Final inspection" };
const STAGE_SECTIONS = { [STAGE_PRE]: SECTION_NAMES_PRE.length, [STAGE_POH]: SECTION_NAMES_POH.length, [STAGE_FINAL]: SECTION_NAMES_FINAL.length };

// ── IS staff field rules ─────────────────────
// Used by the staff forms (staff-ui.js) and re-checked by the API, so both always agree.
const STAFF_PAGE = "is-staff.html";
const PASSWORD_RULES = {
  len:   { label: "8+ characters",    test: v => v.length >= 8 },
  upper: { label: "Uppercase letter", test: v => /[A-Z]/.test(v) },
  lower: { label: "Lowercase letter", test: v => /[a-z]/.test(v) },
  num:   { label: "A number",         test: v => /\d/.test(v) },
  sym:   { label: "A symbol",         test: v => /[^A-Za-z0-9]/.test(v) }
};
const passwordScore = v => Object.values(PASSWORD_RULES).filter(r => r.test(v)).length;

// Accepts "98200 12345", "098200-12345", "+91 98200 12345"; returns "+919820012345" or null
function normalizeContact(v) {
  let d = String(v || "").replace(/[\s\-()]/g, "");
  if (d.startsWith("+91")) d = d.slice(3);
  else if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? "+91" + d : null;
}
function fmtContact(c) { return /^\+91\d{10}$/.test(c || "") ? `+91 ${c.slice(3, 8)} ${c.slice(8)}` : (c || "—"); }

// Returns an error message for one staff field, or "" when the value is fine
function staffFieldError(name, raw) {
  const v = String(raw ?? "").trim();
  switch (name) {
    case "full_name": return !v ? "Enter the staff member's full name."
      : !/^[A-Za-z][A-Za-z .'-]{1,59}$/.test(v) ? "Use letters, spaces, dots, hyphens or apostrophes." : "";
    case "staff_id": return !v ? "Enter the staff ID."
      : !/^[A-Z]{2,4}-\d{3,6}$/i.test(v) ? "Use the format IS-1005 (2–4 letters, hyphen, 3–6 digits)." : "";
    case "contact": return !v ? "Enter the contact number."
      : !normalizeContact(v) ? "Enter a 10-digit Indian mobile number, like 98200 12345." : "";
    case "inspection_stage": return STAGE_LABEL[v] ? "" : "Select an inspection stage.";
    case "email": return !v ? "Enter the email ID."
      : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? "Enter a valid email, like name@example.com." : "";
    case "password": { const p = String(raw ?? "");
      return !p ? "Create a password." : passwordScore(p) < 5 ? "Password must meet all the requirements above." : ""; }
  }
  return "";
}

// ── Coach reassignment rules ─────────────────
// When an inspector is unavailable, the SSE / HOD hands an unfinished coach to another inspector of the same stage.
const REASSIGN_LOG_PAGE = "reassignment-log.html";
const REASSIGN_REASONS = {
  ABSENT: "Absent", ON_LEAVE: "On leave", OTHER_DUTY: "Deployed on other duty",
  WORKLOAD: "Workload balancing", OTHER: "Other"
};
// body gives the other fields, because remarks are required only when the reason is Other
function reassignFieldError(name, raw, body = {}) {
  const v = String(raw ?? "").trim();
  switch (name) {
    case "to_user_id": return v ? "" : "Select the inspector who will take this coach.";
    case "reason": return REASSIGN_REASONS[v] ? "" : "Select a reason.";
    case "remarks": return v.length > 200 ? "Keep remarks under 200 characters."
      : body.reason === "OTHER" && !v ? "Add a remark when the reason is Other." : "";
  }
  return "";
}

// ── Mission-critical watchlist (pre-inspection) ──
const MISSION_CRITICAL_PARAMS = [
  { section: 1, index: 0, sub: "" },
  { section: 3, index: 0, sub: "" },
  { section: 3, index: 1, sub: "" },
  { section: 3, index: 2, sub: "" },
  { section: 3, index: 4, sub: "" },
  { section: 0, index: 4, sub: "K-30" },
  { section: 7, index: 0, sub: "" }
].map(p => ({ ...p, label: FORM_FIELDS_PRE[p.section][p.index], sectionName: SECTION_NAMES_PRE[p.section] }));

// ── Flagged / out-of-range detection ──────────
const MIN_SPEC = { "1-0": 5, "1-1": 3, "1-2": 2, "1-3": 2, "1-4": 1 };
const GOOD_SELECT_VALUES = new Set(["OK", "Earthed", "Working", "Full", "Disconnected", "Already done"]);
const BAD_SELECT_VALUES  = new Set(["Not OK", "Not earthed", "Not working", "Empty", "Not disconnected", "To be done"]);

function paramState(section, index, value) {
  if (!value) return "pending";
  const key = section + "-" + index;
  if (key in MIN_SPEC) { const n = parseFloat(value); return (!isNaN(n) && n < MIN_SPEC[key]) ? "flagged" : "ok"; }
  if (BAD_SELECT_VALUES.has(value)) return "flagged";
  if (GOOD_SELECT_VALUES.has(value)) return "ok";
  return "unrated";
}

// ── Demo entry data for pre-inspection coach visit 1 (WR 201234) ──
const DEMO_ENTRY_PRE = {
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
  return FORM_FIELDS_PRE.map((fields, si) => fields.map(label => DEMO_ENTRY_PRE[si][label] || ""));
}
function effectiveEntry(visit) { return (visit && visit.entry) || demoEntryFor(visit && visit.id); }

function missionCriticalValues(visit) {
  const entry = effectiveEntry(visit);
  return MISSION_CRITICAL_PARAMS.map(p => {
    const value = (entry && entry[p.section] && entry[p.section][p.index]) || "";
    return { ...p, value, state: paramState(p.section, p.index, value) };
  });
}
function flaggedValues(visit) {
  const entry = effectiveEntry(visit);
  if (!entry) return [];
  const mcKeys = new Set(MISSION_CRITICAL_PARAMS.map(p => p.section + "-" + p.index));
  const out = [];
  FORM_FIELDS_PRE.forEach((fields, si) => fields.forEach((label, fi) => {
    if (label === "Any other deficiency") return;
    const value = (entry[si] && entry[si][fi]) || "";
    if (paramState(si, fi, value) === "flagged")
      out.push({ section: si, index: fi, label, sectionName: SECTION_NAMES_PRE[si], sub: "", value, isMissionCritical: mcKeys.has(si + "-" + fi) });
  }));
  return out;
}

// ── Sample data ──────────────────────────────
function _seed() {
  const ago = m => new Date(Date.now() - m * 60000).toISOString();

  // visit factory: id, coach_no, uid, coach_type, status, flagged, sections_done, saved_ago_mins, submitted_ago_mins
  // Staff name, ID, section and stage are copied from the assigned user, so a visit always matches its inspector.
  const visitFor = users => (id, no, uid, type, status, flagged, done, saved, sub) => {
    const s = users.find(x => x.id === uid);
    return {
      id, coach_number: no, coach_type: type, status,
      assigned_to: s.id, assigned_to_name: s.full_name, assigned_to_login: s.login_id,
      section_code: s.section_code, inspection_phase: s.inspection_stage,
      flagged_count: flagged, sections_completed: done, sections_total: STAGE_SECTIONS[s.inspection_stage],
      last_saved_on: saved === null ? null : ago(saved), submitted_on: sub ? ago(sub) : null
    };
  };

  // user factory: id, login_id, full_name, role (IS/SSE/MG), inspection_stage (IS only), section_code,
  //               contact, created_by (user id), created_days_ago
  const u = (id, login, name, role, stage, section, contact, createdBy, days) => ({
    id, login_id: login, full_name: name,
    role,
    is_mgmt_staff: role === "SSE" || role === "MG",
    is_management: role === "MG",
    inspection_stage: stage || null,        // pre_inspection | poh_or_modification | final_inspection
    section_code: section === undefined ? "TL" : section,
    contact: contact || null,
    email: login.toLowerCase().replace(/-/g, ".") + "@wr.indianrailways.gov.in",
    password: "demo123",
    status: "ACTIVE",                       // ACTIVE | DEACTIVATED (deactivated accounts cannot sign in)
    created_by: createdBy || null, created_on: ago((days || 0) * 1440),
    updated_by: null, updated_on: null
  });

  if (!DEMO_DATA) return {
    schema: _SCHEMA, demo: false, nextUserId: 10, nextVisitId: 1,
    users: [u(7, "SSE-1001", "R.K. Gupta", "SSE", null, "TL", "+919876500001", null, 365)],
    visits: [],
    reassignments: [], nextReassignId: 1,
    notifications: [], nextNotifId: 1
  };

  const users = [
    // IS staff — TL section; each has one inspection_stage; created by SSE-1001 (id 5)
    u(1, "IS-1001", "R. Sharma",  "IS", STAGE_PRE,   "TL", "+919876501001", 5, 120),
    u(2, "IS-1002", "A. Verma",   "IS", STAGE_POH,   "TL", "+919876501002", 5,  90),
    u(3, "IS-1003", "K. Nair",    "IS", STAGE_FINAL, "TL", "+919876501003", 5,  60),
    u(4, "IS-1004", "S. Iyer",    "IS", STAGE_PRE,   "TL", "+919876501004", 5,  14),
    // SSE / HOD
    u(5, "SSE-1001", "R.K. Gupta", "SSE", null, "TL", "+919876500001", null, 365),
    // Management — no section
    u(6, "MG-1001", "A.K. Singh",  "MG", null, null, null, null, 365),
    u(7, "MG-1002", "P. Verma",    "MG", null, null, null, null, 365)
  ];
  const v = visitFor(users);
  const visits = [
      // WR 201234 — pre-inspection in progress, flagged, IS-1001 (R. Sharma)
      v(1, "WR 201234", 1, "LHB_NON_AC", "IN_PROGRESS", 6, 3,    2, null),
      // WR 203456 — POH / Modification in progress, IS-1002 (A. Verma)
      v(2, "WR 203456", 2, "LHB_NON_AC", "IN_PROGRESS", 0, 1,   18, null),
      // WR 198765 — pre-inspection submitted, IS-1004 (S. Iyer)
      v(3, "WR 198765", 4, "LHB_NON_AC", "SUBMITTED",   2, 8,   60,   60),
      // WR 201501 — final inspection in progress, IS-1003 (K. Nair)
      v(4, "WR 201501", 3, "LHB_NON_AC", "IN_PROGRESS", 0, 5,   40, null),
      // WR 200987 / WR 202014 — pre-inspection, IS-1001 (R. Sharma)
      v(5, "WR 200987", 1, "LHB_NON_AC", "SUBMITTED",   0, 8, 1440, 1440),
      v(6, "WR 202014", 1, "LHB_NON_AC", "ASSIGNED",    0, 0, null, null)
  ];

  // WR 202014 was first given to S. Iyer, who was absent, so the SSE handed it to R. Sharma
  const handedOver = ago(300), sse = users.find(x => x.id === 5);
  Object.assign(visits[5], { reassign_count: 1,
    last_reassignment: { from_name: "S. Iyer", from_login: "IS-1004", reason: "ABSENT", on: handedOver } });
  const reassignments = [{
    id: 1, visit_id: 6, coach_number: "WR 202014", coach_type: "LHB_NON_AC",
    inspection_phase: STAGE_PRE, section_code: "TL",
    from_user_id: 4, from_login: "IS-1004", from_name: "S. Iyer",
    to_user_id: 1, to_login: "IS-1001", to_name: "R. Sharma",
    reason: "ABSENT", remarks: "Reported sick this morning.",
    status_at_time: "ASSIGNED", sections_completed: 0, sections_total: 8,
    reassigned_by: sse.id, reassigned_by_login: sse.login_id, reassigned_by_name: sse.full_name, reassigned_on: handedOver
  }];

  return {
    schema: _SCHEMA, demo: true, nextUserId: 10, nextVisitId: 7,
    users, visits,
    reassignments, nextReassignId: 2,
    // In-app notifications: generated when a phase is submitted, consumed when SSE/MG views it
    notifications: [
      { id: 1, type: "phase_submitted", visit_id: 3, coach_number: "WR 198765",
        phase: "pre_inspection", submitted_by: "S. Iyer", submitted_by_login: "IS-1004",
        created_at: new Date(Date.now() - 60 * 60000).toISOString(),
        read_by: []   // list of user ids who have read this notification
      }
    ],
    nextNotifId: 2
  };
}

function _db() {
  try { const d = JSON.parse(localStorage.getItem(_DB_KEY)); if (d && d.demo === DEMO_DATA && d.schema === _SCHEMA) return d; } catch (e) {}
  const d = _seed(); _save(d); return d;
}
function _save(d) { localStorage.setItem(_DB_KEY, JSON.stringify(d)); }
function resetDemo() { localStorage.removeItem(_DB_KEY); sessionStorage.removeItem(_SESSION_KEY); }
const _pub = u => u && {
  id: u.id, login_id: u.login_id, full_name: u.full_name,
  is_mgmt_staff: u.is_mgmt_staff,
  is_management: u.is_management || false,
  role: u.role,
  inspection_stage: u.inspection_stage,
  section_code: u.section_code
};

// ── Session ──────────────────────────────────
async function authenticate(loginId, password) {
  const u = _db().users.find(x => x.login_id.toLowerCase() === loginId.toLowerCase());
  if (!u || u.password !== password) throw new Error("Login ID or password is incorrect.");
  if (u.status === "DEACTIVATED") throw new Error("This account has been deactivated. Contact your SSE / HOD.");
  sessionStorage.setItem(_SESSION_KEY, String(u.id));
  return _pub(u);
}
function getUser() {
  const id = +sessionStorage.getItem(_SESSION_KEY), u = _db().users.find(x => x.id === id);
  return u && u.status !== "DEACTIVATED" ? _pub(u) : null;   // a deactivated account loses its session on the next page load
}
function logout() { clearSession(); location.href = LOGIN_PAGE; }
function requireAuth() {
  if (getUser()) return;
  if (!DEMO_DATA) { location.replace(LOGIN_PAGE); return; }
  // Demo convenience: a page opened directly still shows data, using that page's default demo account
  const path = location.pathname;
  let defaultId = 1;   // IS-1001 by default
  if (/executive-dashboard/.test(path)) defaultId = 6;        // MG-1001
  else if (/sse-hod-summary|is-staff|reassignment-log/.test(path)) defaultId = 5;   // SSE-1001
  sessionStorage.setItem(_SESSION_KEY, String(defaultId));
}
function clearSession() { sessionStorage.removeItem(_SESSION_KEY); }

// Helper: where does this user's role land after login?
function homeFor(user) {
  if (!user) return LOGIN_PAGE;
  if (user.is_management) return MGMT_HOME;
  if (user.is_mgmt_staff) return SSE_HOME;
  return IS_HOME;
}

// ── Notifications ─────────────────────────────
// Returns unread notifications for the current user (SSE / MG see all; IS sees none)
function getNotifications() {
  const me = getUser();
  if (!me || !me.is_mgmt_staff) return [];
  const db = _db();
  return (db.notifications || []).filter(n => !(n.read_by || []).includes(me.id));
}

function markNotificationsRead() {
  const me = getUser();
  if (!me || !me.is_mgmt_staff) return;
  const db = _db();
  (db.notifications || []).forEach(n => {
    if (!(n.read_by || []).includes(me.id)) n.read_by.push(me.id);
  });
  _save(db);
}

function _addNotification(visitId, coachNumber, phase, submittedBy, submittedByLogin) {
  const db = _db();
  if (!db.notifications) db.notifications = [];
  if (!db.nextNotifId)   db.nextNotifId = 1;
  db.notifications.push({
    id: db.nextNotifId++,
    type: "phase_submitted",
    visit_id: visitId, coach_number: coachNumber,
    phase, submitted_by: submittedBy, submitted_by_login: submittedByLogin || null,
    created_at: new Date().toISOString(),
    read_by: []
  });
  _save(db);
}

// ── Mock API ──────────────────────────────────
function _res(body, ok = true) { return Promise.resolve({ ok, status: ok ? 200 : 400, json: async () => body }); }

// Visibility: management sees everything, SSE / HOD sees their own section, IS sees only their own assignments
function _canSee(me, v) {
  if (!me) return false;
  if (me.is_management) return true;
  if (me.is_mgmt_staff) return v.section_code === me.section_code;
  return v.assigned_to === me.id;
}
const _inMySection = (me, u) => !!me && (me.is_management || u.section_code === me.section_code);

// ── IS staff management (SSE / HOD only, own section) ──
const _isSSE = me => !!me && me.is_mgmt_staff && !me.is_management;
const _cleanName = s => String(s || "").trim().replace(/\s+/g, " ");
const _openVisits = (db, uid) => db.visits.filter(v => v.assigned_to === uid && v.status !== "SUBMITTED");

function _staffErrors(body, names) {
  const errs = {};
  names.forEach(n => { const e = staffFieldError(n, body[n]); if (e) errs[n] = [e]; });
  return Object.keys(errs).length ? errs : null;
}
// Staff ID, email and contact must be unique across every account
function _staffDuplicates(db, { login, email, contact }, exceptId) {
  const others = db.users.filter(x => x.id !== exceptId);
  if (login && others.some(x => x.login_id.toLowerCase() === login.toLowerCase())) return { staff_id: ["A user with this staff ID already exists."] };
  if (email && others.some(x => (x.email || "").toLowerCase() === email)) return { email: ["A user with this email already exists."] };
  if (contact && others.some(x => x.contact === contact)) return { contact: ["Another user already has this contact number."] };
  return null;
}
// What the staff page sees: profile, audit trail and live assignment counts (never the password)
function _staffView(u, db) {
  const by = id => db.users.find(x => x.id === id);
  const mine = db.visits.filter(v => v.assigned_to === u.id), count = s => mine.filter(v => v.status === s).length;
  const c = by(u.created_by), up = by(u.updated_by);
  const notStarted = count("ASSIGNED"), inProgress = count("IN_PROGRESS");
  return {
    ..._pub(u), email: u.email || "", contact: u.contact || "", status: u.status || "ACTIVE",
    created_by_name: c ? c.full_name : null, created_by_login: c ? c.login_id : null, created_on: u.created_on || null,
    updated_by_name: up ? up.full_name : null, updated_by_login: up ? up.login_id : null, updated_on: u.updated_on || null,
    current_assignments: { active: notStarted + inProgress, not_started: notStarted, in_progress: inProgress, submitted: count("SUBMITTED") },
    open_coaches: mine.filter(v => v.status !== "SUBMITTED").map(v => v.coach_number)
  };
}

// POST /visits/{id}/reassign/ — hand an unfinished coach to another active inspector of the same stage and section.
// Saved readings stay with the coach, and every hand-over is written to the reassignment log.
function _reassignVisit(me, db, id, body) {
  if (!_isSSE(me)) return _res({ detail: "Only SSE / HOD accounts can reassign coaches." }, false);
  const v = db.visits.find(x => x.id === id && x.section_code === me.section_code);
  if (!v) return _res({ detail: "Coach not found in your section." }, false);
  if (v.status === "SUBMITTED") return _res({ detail: `Coach ${v.coach_number} is already submitted and can't be reassigned.` }, false);
  const errs = {};
  ["to_user_id", "reason", "remarks"].forEach(n => { const e = reassignFieldError(n, body[n], body); if (e) errs[n] = [e]; });
  if (Object.keys(errs).length) return _res(errs, false);

  const to = db.users.find(x => x.id === +body.to_user_id && x.role === ROLE_IS && x.section_code === me.section_code);
  if (!to) return _res({ to_user_id: ["Select an inspector from your section."] }, false);
  if (to.status === "DEACTIVATED") return _res({ to_user_id: [`${to.full_name} (${to.login_id}) is deactivated.`] }, false);
  if (to.id === v.assigned_to) return _res({ to_user_id: ["This coach is already with them."] }, false);
  if (to.inspection_stage !== v.inspection_phase)
    return _res({ to_user_id: [`${to.full_name} does ${STAGE_LABEL[to.inspection_stage]}, but this coach needs ${STAGE_LABEL[v.inspection_phase]}.`] }, false);

  const now = new Date().toISOString();
  if (!db.reassignments) db.reassignments = [];
  if (!db.nextReassignId) db.nextReassignId = 1;
  // Names are a snapshot of who held the coach at the time, so the log stays true even after a rename
  const log = {
    id: db.nextReassignId++, visit_id: v.id, coach_number: v.coach_number, coach_type: v.coach_type,
    inspection_phase: v.inspection_phase, section_code: v.section_code,
    from_user_id: v.assigned_to, from_login: v.assigned_to_login, from_name: v.assigned_to_name,
    to_user_id: to.id, to_login: to.login_id, to_name: to.full_name,
    reason: body.reason, remarks: String(body.remarks || "").trim(),
    status_at_time: v.status, sections_completed: v.sections_completed || 0, sections_total: v.sections_total,
    reassigned_by: me.id, reassigned_by_login: me.login_id, reassigned_by_name: me.full_name, reassigned_on: now
  };
  db.reassignments.unshift(log);
  Object.assign(v, {
    assigned_to: to.id, assigned_to_name: to.full_name, assigned_to_login: to.login_id,
    reassign_count: (v.reassign_count || 0) + 1,
    last_reassignment: { from_name: log.from_name, from_login: log.from_login, reason: log.reason, on: now }
  });
  _save(db);
  return _res({ visit: { ...v }, log });
}

// GET /reassignments/ — SSE / HOD sees their section's log; management sees every section
function _reassignmentLog(me, db) {
  if (!me || !me.is_mgmt_staff) return _res({ detail: "Only SSE / HOD and management can view the reassignment log." }, false);
  return _res((db.reassignments || []).filter(r => me.is_management || r.section_code === me.section_code));
}

// GET /staff/ · POST /staff/ · PATCH /staff/{id}/ · POST /staff/{id}/password/ · POST /staff/{id}/status/
function _staffApi(me, db, method, body, id, action) {
  if (!_isSSE(me)) return _res({ detail: "Only SSE / HOD accounts can manage inspection staff." }, false);
  const inSection = x => x.role === ROLE_IS && x.section_code === me.section_code;
  const now = new Date().toISOString();

  if (id === null) {
    if (method === "GET") return _res(db.users.filter(inSection).map(x => _staffView(x, db)));
    const errs = _staffErrors(body, ["full_name", "staff_id", "contact", "inspection_stage", "email", "password"]);
    if (errs) return _res(errs, false);
    const login = body.staff_id.trim().toUpperCase(), email = body.email.trim().toLowerCase(), contact = normalizeContact(body.contact);
    const dup = _staffDuplicates(db, { login, email, contact });
    if (dup) return _res(dup, false);
    const nu = {
      id: db.nextUserId++, login_id: login, full_name: _cleanName(body.full_name), contact, email, password: body.password,
      role: ROLE_IS, is_mgmt_staff: false, is_management: false,
      inspection_stage: body.inspection_stage, section_code: me.section_code,   // new staff join the creator's section
      status: "ACTIVE", created_by: me.id, created_on: now, updated_by: null, updated_on: null
    };
    db.users.push(nu); _save(db);
    return _res(_staffView(nu, db));
  }

  const u = db.users.find(x => x.id === id && inSection(x));
  if (!u) return _res({ detail: "Staff member not found in your section." }, false);
  const open = _openVisits(db, u.id), openList = open.map(v => v.coach_number).join(", ");

  if (action === "password") {
    const errs = _staffErrors(body, ["password"]);
    if (errs) return _res(errs, false);
    u.password = body.password;
  } else if (action === "status") {
    if (!["ACTIVE", "DEACTIVATED"].includes(body.status)) return _res({ detail: "Unknown status." }, false);
    if (body.status === "DEACTIVATED" && open.length)
      return _res({ detail: `${u.full_name} still has unfinished coaches (${openList}). Submit or reassign them before deactivating the account.` }, false);
    u.status = body.status;
  } else if (method === "PATCH") {
    const errs = _staffErrors(body, ["full_name", "contact", "inspection_stage", "email"]);
    if (errs) return _res(errs, false);
    const email = body.email.trim().toLowerCase(), contact = normalizeContact(body.contact);
    const dup = _staffDuplicates(db, { email, contact }, u.id);
    if (dup) return _res(dup, false);
    if (body.inspection_stage !== u.inspection_stage && open.length)
      return _res({ inspection_stage: [`Can't change the stage while ${openList} ${open.length > 1 ? "are" : "is"} unfinished. Submit or reassign first.`] }, false);
    const name = _cleanName(body.full_name);
    if (name !== u.full_name) db.visits.forEach(v => { if (v.assigned_to === u.id) v.assigned_to_name = name; });   // keep coach records in step
    Object.assign(u, { full_name: name, contact, email, inspection_stage: body.inspection_stage });
  } else {
    return _res({}, false);
  }
  u.updated_by = me.id; u.updated_on = now;
  _save(db);
  return _res(_staffView(u, db));
}

async function apiFetch(url, opts = {}) {
  const me = getUser(), db = _db(), method = opts.method || "GET";
  const body = opts.body ? JSON.parse(opts.body) : {};

  const rm = url.match(/\/visits\/(\d+)\/reassign\/$/);
  if (rm && method === "POST") return _reassignVisit(me, db, +rm[1], body);
  if (/\/reassignments\/$/.test(url)) return _reassignmentLog(me, db);

  if (/\/visits\/$/.test(url)) {
    if (method === "GET") return _res(db.visits.filter(v => _canSee(me, v)));
    const phase = body.inspection_phase;
    if (!STAGE_LABEL[phase]) return _res({ inspection_phase: ["Select an inspection stage."] }, false);
    const staff = db.users.find(x => x.id === body.assigned_to && !x.is_mgmt_staff && _inMySection(me, x));
    if (!staff) return _res({ assigned_to: ["Select a valid inspection staff member from your section."] }, false);
    if (staff.status === "DEACTIVATED") return _res({ assigned_to: [`${staff.full_name} (${staff.login_id}) is deactivated.`] }, false);
    if (staff.inspection_stage !== phase)
      return _res({ assigned_to: [`${staff.full_name} (${staff.login_id}) does ${STAGE_LABEL[staff.inspection_stage]}, not ${STAGE_LABEL[phase]}.`] }, false);
    db.visits.unshift({
      id: db.nextVisitId++, coach_number: body.coach_number, coach_type: body.coach_type || "LHB_NON_AC",
      assigned_to: staff.id, assigned_to_name: staff.full_name, assigned_to_login: staff.login_id,
      section_code: staff.section_code, inspection_phase: phase,
      section_no: body.section_no || "", overhaul_type: body.overhaul_type || "",
      coach_in_date: body.coach_in_date || null, pre_inspection_date: body.pre_inspection_date || null,
      status: "ASSIGNED", flagged_count: 0, sections_completed: 0, sections_total: STAGE_SECTIONS[phase],
      last_saved_on: null, submitted_on: null
    });
    _save(db); return _res({ ok: true });
  }
  const sm = url.match(/\/staff\/(?:(\d+)\/(?:(password|status)\/)?)?$/);
  if (sm) return _staffApi(me, db, method, body, sm[1] ? +sm[1] : null, sm[2] || null);
  return _res({}, false);
}

function getVisit(id) { const v = _db().visits.find(x => x.id === +id); return v ? { ...v } : null; }

// Inspection staff may only write to coaches currently assigned to them (a reassigned coach is read-only for its former inspector)
function canEditVisit(v, me = getUser()) {
  return !!v && !!me && v.status !== "SUBMITTED" && (me.role !== ROLE_IS || v.assigned_to === me.id);
}

function saveVisitProgress(id, done, entry) {
  const db = _db(), v = db.visits.find(x => x.id === +id);
  if (!canEditVisit(v)) return false;
  v.status = "IN_PROGRESS"; v.sections_completed = done; v.last_saved_on = new Date().toISOString();
  if (entry) v.entry = entry;
  _save(db);
  return true;
}

function submitVisit(id, done, entry) {
  const db = _db(), v = db.visits.find(x => x.id === +id);
  const me = getUser();
  if (!canEditVisit(v, me)) return false;
  v.status = "SUBMITTED"; v.sections_completed = done ?? v.sections_total;
  if (entry) v.entry = entry;
  v.last_saved_on = v.submitted_on = new Date().toISOString();
  _save(db);
  // Create a notification for SSE / MG
  _addNotification(id, v.coach_number, v.inspection_phase || STAGE_PRE, me ? me.full_name : "Inspection staff", me && me.login_id);
  return true;
}

// ── Export file naming ────────────────────────
function exportFileBase(coachNo, func) {
  const d = new Date(), pad = n => String(n).padStart(2, "0");
  return `${coachNo}_${func}_${pad(d.getDate())}${pad(d.getMonth() + 1)}${d.getFullYear()}`;
}

// ── Export (real files, generated in the browser) ──
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
  const make = () => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([head, ...rows]), "Sheet1"); XLSX.writeFile(wb, base + ".xlsx"); };
  if (window.XLSX) return make();
  const sc = document.createElement("script");
  sc.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
  sc.onload = make;
  sc.onerror = () => { showToast("Excel export needs an internet connection — saved as CSV instead.", "error"); csv(); };
  document.head.appendChild(sc);
}

function demoExport(format) {
  const db = _db(), me = getUser();
  const rows = db.visits.filter(v => _canSee(me, v))
    .map(v => [v.coach_number, v.assigned_to_login || "—", v.assigned_to_name || "—", v.section_code || "—",
      STAGE_LABEL[v.inspection_phase] || "—", _TYPE_LABEL[v.coach_type] || v.coach_type,
      v.status === "SUBMITTED" ? "Submitted" : v.status === "ASSIGNED" ? "Not started" : "In progress",
      v.flagged_count, v.last_saved_on ? fmtDateTime(v.last_saved_on) : "—"]);
  const head = ["Coach", "IS ID", "Inspection staff", "Section", "Stage", "Type", "Status", "Flagged params", "Last saved"];
  exportRows(exportFileBase("all-coaches", "live-inspections"), "Live inspections — " + new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }), head, rows, format);
}

// ── Small UI helpers ──────────────────────────
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
// "R. Sharma (IS-1001)"; avoids "IS-1005 (IS-1005)" for accounts whose name is their ID
function staffLabel(name, loginId) {
  if (!loginId || loginId === name) return name || loginId || "—";
  return `${name || "—"} (${loginId})`;
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
