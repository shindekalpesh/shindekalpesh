/* staff-ui.js — shared windows for managing IS staff (SSE / HOD only):
   create, edit, reset password, reassign a coach, and a confirm prompt.
   Used by is-staff.html and sse-hod-summary.html. Load after api.js — the field rules
   (staffFieldError, reassignFieldError, PASSWORD_RULES) live there, so these forms and the API always agree. */
const StaffForm = (() => {
  const CSS = `
.sf-bg{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:100;align-items:center;justify-content:center}
.sf-bg.show{display:flex}
.sf-modal{background:#fff;border-radius:12px;padding:26px 28px;width:500px;max-width:92vw;max-height:88vh;overflow-y:auto;color:#16232E;font-family:'Outfit',-apple-system,sans-serif;box-sizing:border-box}
.sf-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.sf-head h2{font-size:18px;font-weight:600;margin:0 0 4px}
.sf-sub{font-size:13px;color:#7E8B98;margin:0}
.sf-x{border:none;background:none;font-size:24px;line-height:1;color:#7E8B98;cursor:pointer;padding:2px 8px;border-radius:6px}
.sf-x:hover{background:#EEF1F3}
.sf-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}
.sf-f{min-width:0}
.sf-f.full{grid-column:1/-1}
.sf-modal label{display:block;font-size:13px;font-weight:500;color:#4A5A6A;margin:14px 0 5px}
.sf-modal textarea{resize:vertical;min-height:64px}
.sf-modal input,.sf-modal select,.sf-modal textarea{width:100%;border:1px solid #E2E6EA;border-radius:7px;padding:9px 11px;font-size:14px;font-family:inherit;color:#16232E;background:#fff;box-sizing:border-box}
.sf-modal input:focus,.sf-modal select:focus,.sf-modal textarea:focus{outline:none;border-color:#2F6690;box-shadow:0 0 0 3px #E9F0F5}
.sf-modal input[readonly],.sf-modal select:disabled{background:#EEF1F3;color:#4A5A6A;cursor:default}
.sf-modal .invalid{border-color:#D9776B}
.sf-modal .invalid:focus{box-shadow:0 0 0 3px #FBEAE7}
.sf-msg{font-size:12px;color:#7E8B98;margin-top:5px;line-height:1.4}
.sf-msg.err{color:#9C2B1F}
.sf-pw{position:relative}
.sf-pw input{padding-right:62px}
.sf-pwt{position:absolute;right:6px;top:50%;transform:translateY(-50%);border:none;background:none;color:#2F6690;font-family:inherit;font-size:12.5px;font-weight:500;cursor:pointer;padding:6px 8px;border-radius:5px}
.sf-pwt:hover{background:#E9F0F5}
.sf-strength{display:flex;align-items:center;gap:10px;margin-top:10px}
.sf-segs{flex:1;display:grid;grid-template-columns:repeat(4,1fr);gap:4px}
.sf-segs span{height:4px;border-radius:2px;background:#EEF1F3;transition:background .2s}
.sf-sword{font-size:12px;font-weight:500;min-width:48px;text-align:right;color:#7E8B98}
.sf-rules{list-style:none;margin:10px 0 0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:4px 12px}
.sf-rules li{font-size:12.5px;color:#7E8B98;display:flex;align-items:center;gap:7px}
.sf-rules i{width:14px;height:14px;border-radius:50%;border:1.5px solid #E2E6EA;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:8px;color:#fff;flex-shrink:0}
.sf-rules li.ok{color:#4A5A6A}
.sf-rules li.ok i{background:#2E7D4F;border-color:#2E7D4F}
.sf-audit{margin-top:18px;padding:10px 12px;background:#F6F7F9;border-radius:8px;font-size:12.5px;color:#4A5A6A;line-height:1.65}
.sf-audit b{font-weight:600;color:#16232E}
.sf-text{font-size:14px;color:#4A5A6A;margin:14px 0 0;line-height:1.55}
.sf-info{margin-top:16px;padding:12px 14px;background:#F6F7F9;border:1px solid #EEF1F3;border-radius:8px;font-size:13px;color:#4A5A6A;line-height:1.6}
.sf-info b{color:#16232E;font-weight:600}
.sf-note{margin-top:14px;padding:9px 12px;background:#E9F0F5;border-radius:7px;font-size:12.5px;color:#2F6690;line-height:1.5}
.sf-actions{display:flex;gap:10px;margin-top:22px;justify-content:flex-end}
.sf-btn{font-family:inherit;font-size:14px;padding:9px 18px;border-radius:7px;cursor:pointer;border:1px solid #E2E6EA;background:#fff;color:#16232E;font-weight:500}
.sf-btn:hover{background:#EEF1F3}
.sf-btn.primary{background:#E8871E;border-color:#E8871E;color:#3A2200;font-weight:600}
.sf-btn.primary:hover{background:#D97A16}
.sf-btn.danger{background:#9C2B1F;border-color:#9C2B1F;color:#fff;font-weight:600}
.sf-btn.danger:hover{background:#86241A}
.sf-btn:disabled{opacity:.7;cursor:default}
.sf-btn:focus-visible,.sf-x:focus-visible,.sf-pwt:focus-visible{outline:2px solid #2F6690;outline-offset:2px}
@media (max-width:560px){.sf-grid{grid-template-columns:1fr}}
`;

  const STAGE_OPTS = '<option value="">Select stage</option>' +
    Object.entries(STAGE_LABEL).map(([k, l]) => `<option value="${k}">${l}</option>`).join("");
  const FIELDS = {
    full_name:        { label: "Full name *",        help: "As it should appear on reports.",
      html: '<input id="sf_full_name" type="text" maxlength="60" placeholder="e.g. P. Kulkarni" spellcheck="false" autocomplete="off">' },
    staff_id:         { label: "Staff ID *",         help: "Used to sign in. Can't be changed later.",
      html: '<input id="sf_staff_id" type="text" maxlength="12" placeholder="e.g. IS-1005" spellcheck="false" autocomplete="off">' },
    contact:          { label: "Contact number *",   help: "10-digit mobile number.",
      html: '<input id="sf_contact" type="tel" maxlength="16" placeholder="e.g. 98200 12345" autocomplete="off">' },
    inspection_stage: { label: "Inspection stage *", help: "Decides which inspection form they fill.",
      html: `<select id="sf_inspection_stage">${STAGE_OPTS}</select>` },
    section:          { label: "Workshop section",   help: "Staff belong to your section.",
      html: '<input id="sf_section" type="text" readonly>' },
    email:            { label: "Staff email ID *",   help: "",
      html: '<input id="sf_email" type="email" placeholder="name@example.com" spellcheck="false" autocomplete="off">' },
    password:         { label: "Password *",         help: "", full: true,
      html: `<div class="sf-pw"><input id="sf_password" type="password" placeholder="Create a password" autocomplete="new-password">
        <button type="button" class="sf-pwt" id="sf_pwt" aria-label="Show password">Show</button></div>
        <div class="sf-strength" aria-hidden="true"><div class="sf-segs"><span></span><span></span><span></span><span></span></div><div class="sf-sword" id="sf_pw_word"></div></div>
        <ul class="sf-rules">${Object.entries(PASSWORD_RULES).map(([k, r]) => `<li data-r="${k}"><i>✓</i>${r.label}</li>`).join("")}</ul>` }
  };

  let bg, form, title, sub, resolveConfirm = null;
  const el = id => document.getElementById(id);

  function mount() {
    if (bg) return;
    const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    bg = document.createElement("div"); bg.className = "sf-bg";
    bg.innerHTML = `<div class="sf-modal" role="dialog" aria-modal="true" aria-labelledby="sfTitle">
        <div class="sf-head"><div><h2 id="sfTitle"></h2><p class="sf-sub" id="sfSub"></p></div>
          <button type="button" class="sf-x" aria-label="Close">&times;</button></div>
        <form id="sfForm" novalidate autocomplete="off"></form>
      </div>`;
    document.body.appendChild(bg);
    form = el("sfForm"); title = el("sfTitle"); sub = el("sfSub");
    bg.querySelector(".sf-x").onclick = close;
    bg.addEventListener("mousedown", e => { if (e.target === bg) close(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && bg.classList.contains("show")) close(); });
  }
  function close() {
    bg.classList.remove("show");
    if (resolveConfirm) { const r = resolveConfirm; resolveConfirm = null; r(false); }
  }
  function open(t, s, html) {
    mount();
    if (resolveConfirm) { const r = resolveConfirm; resolveConfirm = null; r(false); }
    title.textContent = t; sub.textContent = s; form.innerHTML = html; form.onsubmit = null;
    bg.classList.add("show");
  }

  const field = (name, full) => {
    const f = FIELDS[name];
    return `<div class="sf-f${full || f.full ? " full" : ""}"><label for="sf_${name}">${f.label}</label>${f.html}<div class="sf-msg" id="sf_${name}_msg">${f.help}</div></div>`;
  };
  const actions = (secondary, primary, cls = "primary") =>
    `<div class="sf-actions"><button type="button" class="sf-btn" id="sf_secondary">${secondary}</button><button type="submit" class="sf-btn ${cls}" id="sf_primary">${primary}</button></div>`;

  function val(name) {
    const v = el("sf_" + name).value;
    if (name === "password") return v;
    if (name === "staff_id") return v.trim().toUpperCase();
    if (name === "email") return v.trim().toLowerCase();
    return v.trim();
  }
  function showErr(name, msg) {
    const input = el("sf_" + name), m = el("sf_" + name + "_msg");
    if (!input || !m) return;
    input.classList.toggle("invalid", !!msg);
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    m.textContent = msg || m.dataset.help || (FIELDS[name] && FIELDS[name].help) || "";
    m.classList.toggle("err", !!msg);
  }
  function updateStrength(v) {
    form.querySelectorAll(".sf-rules li").forEach(li => li.classList.toggle("ok", PASSWORD_RULES[li.dataset.r].test(v)));
    const sc = passwordScore(v), lvl = !v ? 0 : sc <= 2 ? 1 : sc === 3 ? 2 : sc === 4 ? 3 : 4;
    const cols = ["", "#D9776B", "#E8871E", "#5B95BF", "#2E7D4F"], words = ["", "Weak", "Fair", "Good", "Strong"];
    form.querySelectorAll(".sf-segs span").forEach((s, i) => s.style.background = i < lvl ? cols[lvl] : "");
    const w = el("sf_pw_word"); w.textContent = words[lvl]; w.style.color = cols[lvl];
  }

  // Live checks: show a field's error once it has been left, then keep it current while typing.
  // check(name, value) returns an error message or ""; staff forms use staffFieldError from api.js.
  function wire(names, check = staffFieldError) {
    const touched = {};
    names.forEach(n => {
      const input = el("sf_" + n);
      input.addEventListener("blur", () => { touched[n] = true; showErr(n, check(n, val(n))); });
      input.addEventListener(input.tagName === "SELECT" ? "change" : "input", () => {
        if (n === "staff_id") input.value = input.value.toUpperCase();
        if (n === "password") updateStrength(input.value);
        if (touched[n]) showErr(n, check(n, val(n)));
      });
    });
    const t = el("sf_pwt");
    if (t) t.onclick = () => {
      const p = el("sf_password"), show = p.type === "password";
      p.type = show ? "text" : "password"; t.textContent = show ? "Hide" : "Show";
      t.setAttribute("aria-label", show ? "Hide password" : "Show password");
    };
  }

  // Validate → send → map server errors back onto fields
  function onSubmit(names, send, done, check = staffFieldError) {
    form.onsubmit = async e => {
      e.preventDefault();
      let first = null;
      names.forEach(n => { const err = check(n, val(n)); showErr(n, err); if (err && !first) first = n; });
      if (first) { el("sf_" + first).focus(); return; }
      const body = {}; names.forEach(n => body[n] = val(n));
      const btn = el("sf_primary"), label = btn.textContent;
      btn.disabled = true; btn.textContent = "Saving…";
      try {
        const res = await send(body), data = await res.json().catch(() => ({}));
        if (res.ok) { bg.classList.remove("show"); done(data); return; }
        let shown = false;
        Object.keys(data).forEach(k => { if (k !== "detail" && el("sf_" + k)) { showErr(k, [].concat(data[k]).join(" ")); shown = true; } });
        if (!shown) showToast(data.detail || "Could not save. Try again.", "error");
      } finally { btn.disabled = false; btn.textContent = label; }
    };
  }

  function audit(s) {
    const when = t => t ? new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
    const created = s.created_by_name ? staffLabel(s.created_by_name, s.created_by_login) : "System";
    return `<div class="sf-audit">Created by <b>${esc(created)}</b> on ${when(s.created_on)}` +
      (s.updated_on ? `<br>Last updated by <b>${esc(staffLabel(s.updated_by_name, s.updated_by_login))}</b> on ${when(s.updated_on)}` : "") +
      "</div>";
  }

  // ── Public ──
  function create(onSaved) {
    const names = ["full_name", "staff_id", "contact", "inspection_stage", "email", "password"];
    open("Create staff user account", "The staff member can sign in with these details right away.",
      `<div class="sf-grid">${field("full_name", true)}${field("staff_id")}${field("contact")}${field("inspection_stage")}${field("section")}${field("email", true)}${field("password")}</div>` +
      actions("Reset form", "Create user"));
    el("sf_section").value = getUser()?.section_code || "—";
    el("sf_secondary").onclick = () => create(onSaved);
    wire(names);
    onSubmit(names, body => apiFetch(`${API}/staff/`, { method: "POST", body: JSON.stringify(body) }), s => {
      showToast(`Staff user ${s.full_name} (${s.login_id}) created — ${STAGE_LABEL[s.inspection_stage]}, section ${s.section_code}.`);
      onSaved && onSaved(s);
    });
    el("sf_full_name").focus();
  }

  function edit(s, onSaved) {
    const names = ["full_name", "contact", "inspection_stage", "email"];
    open("Edit staff details", `${s.full_name} · ${s.login_id}`,
      `<div class="sf-grid">${field("full_name", true)}${field("staff_id")}${field("contact")}${field("inspection_stage")}${field("section")}${field("email", true)}</div>` +
      audit(s) + actions("Cancel", "Save changes"));
    el("sf_full_name").value = s.full_name;
    el("sf_staff_id").value = s.login_id; el("sf_staff_id").readOnly = true;
    el("sf_staff_id_msg").textContent = "The sign-in ID can't be changed.";
    el("sf_contact").value = s.contact ? fmtContact(s.contact).replace(/^\+91 /, "") : "";
    el("sf_inspection_stage").value = s.inspection_stage || "";
    el("sf_section").value = s.section_code || "—";
    el("sf_email").value = s.email || "";
    if (s.open_coaches && s.open_coaches.length) {
      // Stage is locked while coaches are unfinished — the API refuses the change too
      const m = el("sf_inspection_stage_msg");
      el("sf_inspection_stage").disabled = true;
      m.dataset.help = m.textContent = `Locked: ${s.open_coaches.join(", ")} ${s.open_coaches.length > 1 ? "are" : "is"} unfinished. Submit or reassign first.`;
    }
    el("sf_secondary").onclick = close;
    wire(names);
    onSubmit(names, body => apiFetch(`${API}/staff/${s.id}/`, { method: "PATCH", body: JSON.stringify(body) }), u => {
      showToast(`Saved changes for ${u.full_name} (${u.login_id}).`);
      onSaved && onSaved(u);
    });
    el("sf_full_name").focus();
  }

  function resetPassword(s, onSaved) {
    open("Reset password", `${s.full_name} · ${s.login_id}`,
      `<p class="sf-text">Set a temporary password and share it with them directly. Their old password stops working right away.</p>
       <div class="sf-grid">${field("password")}</div>` + actions("Cancel", "Set password"));
    el("sf_password").placeholder = "New password";
    el("sf_secondary").onclick = close;
    wire(["password"]);
    onSubmit(["password"], body => apiFetch(`${API}/staff/${s.id}/password/`, { method: "POST", body: JSON.stringify(body) }), u => {
      showToast(`Password reset for ${u.full_name} (${u.login_id}).`);
      onSaved && onSaved(u);
    });
    el("sf_password").focus();
  }

  // Hand an unfinished coach to another active inspector of the same stage (e.g. the assigned one is absent today)
  async function reassign(v, onSaved) {
    const res = await apiFetch(`${API}/staff/`);
    const staff = res.ok ? await res.json() : [];
    const choices = staff
      .filter(s => s.status !== "DEACTIVATED" && s.inspection_stage === v.inspection_phase && s.id !== v.assigned_to)
      .sort((a, b) => a.current_assignments.active - b.current_assignments.active || a.login_id.localeCompare(b.login_id, "en", { numeric: true }));
    const stage = STAGE_LABEL[v.inspection_phase] || "—";
    const progress = v.status === "ASSIGNED" ? "Not started"
      : `In progress · ${v.sections_completed || 0} of ${v.sections_total} sections complete`;
    const staffOpts = choices.length
      ? '<option value="">Select inspector</option>' + choices.map(s =>
          `<option value="${s.id}">${esc(s.full_name)} — ${esc(s.login_id)} · ${s.current_assignments.active ? s.current_assignments.active + " active" : "free"}</option>`).join("")
      : `<option value="">No other active ${esc(stage)} inspector in section ${esc(v.section_code)}</option>`;
    const reasonOpts = '<option value="">Select reason</option>' +
      Object.entries(REASSIGN_REASONS).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join("");
    const toHelp = choices.length ? `Active ${stage} inspectors in section ${v.section_code}, least busy first.`
      : "Create or reactivate an inspector for this stage on the IS Staff page.";
    const remarksHelp = "Required when the reason is Other. Up to 200 characters.";

    open("Reassign coach", `Coach ${v.coach_number} · ${stage}`,
      `<div class="sf-info">Currently with <b>${esc(staffLabel(v.assigned_to_name, v.assigned_to_login))}</b><br>` +
        `${esc(progress)}${v.last_saved_on ? " · last saved " + esc(fmtDateTime(v.last_saved_on)) : ""}</div>
       <div class="sf-grid">
         <div class="sf-f full"><label for="sf_to_user_id">Reassign to *</label>
           <select id="sf_to_user_id"${choices.length ? "" : " disabled"}>${staffOpts}</select>
           <div class="sf-msg" id="sf_to_user_id_msg" data-help="${esc(toHelp)}">${esc(toHelp)}</div></div>
         <div class="sf-f full"><label for="sf_reason">Reason *</label>
           <select id="sf_reason">${reasonOpts}</select>
           <div class="sf-msg" id="sf_reason_msg"></div></div>
         <div class="sf-f full"><label for="sf_remarks">Remarks</label>
           <textarea id="sf_remarks" maxlength="200" placeholder="e.g. Absent today, informed at 9:15"></textarea>
           <div class="sf-msg" id="sf_remarks_msg" data-help="${remarksHelp}">${remarksHelp}</div></div>
       </div>
       <div class="sf-note">${v.status === "IN_PROGRESS"
          ? "Readings saved so far stay with the coach — the new inspector continues from where it was left."
          : "The coach appears in the new inspector's assignments straight away."}
         ${esc(v.assigned_to_name)} will no longer be able to edit it. This hand-over is recorded in the reassignment log.</div>` +
      actions("Cancel", "Reassign coach"));

    const names = ["to_user_id", "reason", "remarks"];
    const check = (n, value) => reassignFieldError(n, value, { reason: val("reason") });
    el("sf_secondary").onclick = close;
    wire(names, check);
    // Picking or changing the reason decides whether remarks are required
    el("sf_reason").addEventListener("change", () => { if (el("sf_remarks").classList.contains("invalid")) showErr("remarks", check("remarks", val("remarks"))); });
    onSubmit(names,
      body => apiFetch(`${API}/visits/${v.id}/reassign/`, { method: "POST", body: JSON.stringify({ ...body, to_user_id: +body.to_user_id }) }),
      d => {
        showToast(`Coach ${v.coach_number} reassigned to ${staffLabel(d.log.to_name, d.log.to_login)}.`);
        onSaved && onSaved(d);
      }, check);
    (choices.length ? el("sf_to_user_id") : el("sf_secondary")).focus();
  }

  // Promise<boolean>; text is plain text
  function confirm({ title: t, subtitle = "", text, ok = "Confirm", danger = false }) {
    open(t, subtitle, `<p class="sf-text">${esc(text)}</p>` + actions("Cancel", ok, danger ? "danger" : "primary"));
    return new Promise(resolve => {
      resolveConfirm = resolve;
      el("sf_secondary").onclick = close;
      form.onsubmit = e => { e.preventDefault(); resolveConfirm = null; bg.classList.remove("show"); resolve(true); };
      el("sf_primary").focus();
    });
  }

  return { create, edit, resetPassword, reassign, confirm };
})();
