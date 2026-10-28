import React, { useEffect, useRef, useState } from "react";
import { LessonEditor } from "./admin-editors.jsx";
import { sb, tables, readAll, inviteAcademicAdmin } from "./client.js";
import {
  dashboardCounts,
  displayGroupName,
  dateOfLesson,
  courseLessons,
  localDate,
  monthsOf,
  paymentPayload,
  paymentRows,
  payrollPartsTotal,
  payrollTotal,
  retentionLabel,
  topGroupsByPerformance,
  topTeachersByRetention,
  validDate,
  yearlyFinanceSeries,
} from "./logic.js";

const nav = [
  "Dashboard",
  "Students",
  "Groups",
  "Support",
  "Payroll",
  "Finance",
];
const financeOnlyTables = new Set(["periods", "payroll", "payments"]);
const financeRoles = new Set(["owner_admin", "academic_manager", "finance", "academic_admin"]);
const appUrl = "https://academic-department-os.onrender.com/";
const emptyData = Object.fromEntries(
  Object.keys(tables).map((key) => [key, []]),
);
const fmt = (value) => Number(value || 0).toLocaleString("en-US");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isFutureJwtError = (error) =>
  /PGRST303|JWT issued at future/i.test(error?.message || String(error));
export async function readAppData(read = readAll, pause = wait, userId) {
  const retryDelays = [1000, 2500, 5000];
  for (let attempt = 0; ; attempt++) {
    try {
      const profiles = await read(tables.profiles);
      const caller = profiles.find((profile) => profile.id === userId) || (userId ? null : profiles[0]);
      if (!caller) throw new Error("No access profile exists for this account. Ask the owner to activate it.");
      if (!caller.active) throw new Error("Your account is inactive. Ask the owner to restore access.");
      const canViewFinance = financeRoles.has(caller.role);
      const entries = await Promise.all(Object.entries(tables)
        .filter(([key]) => key !== "profiles" && !( !canViewFinance && financeOnlyTables.has(key)))
        .map(async ([key, table]) => [key, await read(table)]));
      entries.push(["profiles", profiles]);
      return Object.fromEntries(entries);
    } catch (error) {
      if (!isFutureJwtError(error) || attempt >= retryDelays.length) throw error;
      await pause(retryDelays[attempt]);
    }
  }
}
export function Card({ n, t }) {
  return (
    <div className="card">
      <b>{n}</b>
      <span>{t}</span>
    </div>
  );
}
export function Table({ heads, rows }) {
  return (
    <div className="table">
      <table>
        <thead>
          <tr>
            {heads.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((value, j) => (
                <td key={j}>{value ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function App({ Students, Groups }) {
  const [session, setSession] = useState(null),
    [authReady, setAuthReady] = useState(false);
  const [page, setPage] = useState("Dashboard"),
    [email, setEmail] = useState(""),
    [pw, setPw] = useState("");
  const [passwordSetup, setPasswordSetup] = useState(() => new URLSearchParams(window.location.search).get("setup") === "invite");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSetupBusy, setPasswordSetupBusy] = useState(false);
  const [passwordSetupError, setPasswordSetupError] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const [data, setData] = useState(emptyData),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    sb.auth
      .getSession()
      .then(({ data, error }) => {
        if (alive) {
          setSession(data.session);
          setAuthReady(true);
          if (error) setError(error.message);
        }
      })
      .catch((e) => {
        if (alive) {
          setError(e.message);
          setAuthReady(true);
        }
      });
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_, value) => {
      setSession(value);
      setAuthReady(true);
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);
  const userId = session?.user.id;
  useEffect(() => {
    let alive = true;
    if (!userId) {
      setData(emptyData);
      return;
    }
    setLoading(true);
    setError("");
    readAppData(readAll, wait, userId)
      .then((loaded) => {
        if (alive) setData(loaded);
      })
      .catch((e) => {
        if (alive) setError(`Could not load data. ${e.message}`);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId, revision]);
  const refresh = () => setRevision((value) => value + 1);
  const profile = (data.profiles || []).find((row) => row.id === userId);
  const academicOnly = profile?.active && profile.role === "academic_admin";
  const canManageAdmins = profile?.active && profile.role === "owner_admin";
  const canViewFinance = profile?.active && financeRoles.has(profile.role);
  const visibleNav = nav.filter((name) =>
    ((name !== "Payroll" && name !== "Finance") || canViewFinance) && (name !== "Support" || !academicOnly));
  function recordSaved(table, row) {
    const matches = (x) =>
      table === "scores"
        ? x.exam_id === row.exam_id && x.student_id === row.student_id
        : ["attendance", "homework"].includes(table)
          ? x.lesson_id === row.lesson_id && x.student_id === row.student_id
          : x.id === row.id;
    setData((old) => ({
      ...old,
      [table]: [...old[table].filter((x) => !matches(x)), row],
    }));
  }
  async function saveInitialPassword(event) {
    event.preventDefault();
    setPasswordSetupError("");
    if (newPassword !== confirmPassword) {
      setPasswordSetupError("The passwords do not match.");
      return;
    }
    setPasswordSetupBusy(true);
    try {
      const { error } = await sb.auth.updateUser({ password: newPassword });
      if (error) throw error;
      const url = new URL(window.location.href);
      url.searchParams.delete("setup");
      window.history.replaceState({}, document.title, url.toString());
      setPasswordSetup(false);
      setPage("Dashboard");
    } catch (error) {
      setPasswordSetupError(error.message || "Could not save your password. Request a new invitation link.");
    } finally {
      setPasswordSetupBusy(false);
    }
  }
  async function sendPasswordReset() {
    setResetMessage("");
    setResetError("");
    if (!email.trim()) {
      setResetError("Enter your email address first.");
      return;
    }
    try {
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${appUrl}?setup=invite`,
      });
      if (error) throw error;
      setResetMessage("If this account exists, a password setup link has been sent.");
    } catch (error) {
      setResetError(error.message || "Could not send the password setup link.");
    }
  }
  if (!authReady)
    return (
      <main>
        <p role="status">Checking sign-in…</p>
      </main>
    );
  if (passwordSetup)
    return (
      <main className="login">
        <form onSubmit={saveInitialPassword}>
          <h1>Set your password</h1>
          {session ? (
            <>
              <p>Choose a password to finish setting up your Academic OS account.</p>
              <label>Password<input aria-label="New password" type="password" autoComplete="new-password" minLength="8" required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
              <label>Confirm password<input aria-label="Confirm password" type="password" autoComplete="new-password" minLength="8" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
              <button disabled={passwordSetupBusy}>{passwordSetupBusy ? "Saving…" : "Save password"}</button>
            </>
          ) : (
            <p role="alert">This invitation link is invalid, expired, or already used. Ask the owner to send a new setup link.</p>
          )}
          {passwordSetupError && <p role="alert">{passwordSetupError}</p>}
        </form>
      </main>
    );
  if (!session)
    return (
      <main className="login">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            try {
              const result = await sb.auth.signInWithPassword({
                email,
                password: pw,
              });
              if (result.error) setError(result.error.message);
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          <h1>Academic Department OS</h1>
          <p>Sign in to continue</p>
          <input
            aria-label="Email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            aria-label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          <button type="submit">Sign in</button>
          <button type="button" onClick={sendPasswordReset}>Forgot password? Send setup link</button>
          {resetMessage && <p role="status">{resetMessage}</p>}
          {resetError && <p role="alert">{resetError}</p>}
          {error && <p role="alert">{error}</p>}
        </form>
      </main>
    );
  return (
    <div className="app">
      <aside>
        <h2>Academic OS</h2>
        {visibleNav.map((name) => (
          <button
            key={name}
            className={page === name ? "on" : ""}
            onClick={() => setPage(name)}
          >
            {name}
          </button>
        ))}
        {canManageAdmins && <button className={page === "Admin Access" ? "on" : ""} onClick={() => setPage("Admin Access")}>Admin Access</button>}
        <button
          onClick={async () => {
            const result = await sb.auth.signOut();
            if (result.error) setError(result.error.message);
          }}
        >
          Sign out
        </button>
      </aside>
      <main>
        <header>
          <h1>{page}</h1>
        </header>
        {loading ? (
          <p role="status">Loading data…</p>
        ) : error ? (
          <div className="error" role="alert">
            {error} <button onClick={refresh}>Retry</button>
          </div>
        ) : (
          <React.Fragment key={page}>
            {page === "Dashboard" ? (
              <Dashboard d={data} showFinance={canViewFinance} />
            ) : page === "Students" ? (
              <Students d={data} refresh={refresh} onRecordSaved={recordSaved} />
            ) : page === "Groups" ? (
              <Groups d={data} onRecordSaved={recordSaved} />
            ) : page === "Support" ? (
              <section className="panel">
                <h2>Support</h2>
                <p>On progress</p>
              </section>
            ) : page === "Admin Access" && canManageAdmins ? (
              <AdminAccess onInvited={recordSaved} />
            ) : page === "Payroll" && canViewFinance ? (
              <Payroll d={data} />
            ) : page === "Finance" && canViewFinance ? (
              <Finance d={data} refresh={refresh} onRecordSaved={recordSaved} readOnly={academicOnly} />
            ) : (
              <p role="alert">This page is not available for your account.</p>
            )}
          </React.Fragment>
        )}
      </main>
    </div>
  );
}

export function Dashboard({ d, showFinance = true }) {
  const months = monthsOf([
    ...d.lessons.map(dateOfLesson),
    ...d.students.flatMap((s) => [s.joined_at, s.left_at]),
    ...(d.periods || []).map((p) => p.period_month),
    ...(d.rosters||[]).map(r=>r.period_month),
    ...(d.rosterHistory||[]).map(r=>r.source_type || r.source_month),
  ]);
  const [choice, setChoice] = useState("");
  const month = months.includes(choice) ? choice : months[0] || "";
  const counts = dashboardCounts(d, month);
  const hasMonthlyRoster=(d.rosters||[]).some(r=>r.period_month.startsWith(month));
  const hasHistoricalRoster=(d.rosterHistory||[]).some(r=>String(r.source_type||r.source_month||"").startsWith(month));
  const incompleteHistory = !hasMonthlyRoster&&d.students.some(s => !s.joined_at || (['left','paused','graduated'].includes(s.status) && !s.left_at));
  return (
    <>
      {incompleteHistory && !hasHistoricalRoster && <p role="status" className="hint">Historical student counts are estimates: imported join or leave dates are missing. Groups and lessons use recorded lesson dates.</p>}
      <div className="formbar">
        <label>
          Month{" "}
          <select value={month} onChange={(e) => setChoice(e.target.value)}>
            {months.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="cards">
        <Card n={counts.active} t="Active Students" />
        <Card n={counts.left} t="Left Students" />
        <Card n={counts.groups} t="Groups" />
        <Card n={counts.lessons} t="Lessons" />
      </div>
      <p className="hint">{hasMonthlyRoster?'Student and group counts use the selected month’s roster. Lessons use recorded calendar dates.':hasHistoricalRoster?'Student and group counts use the imported historical roster. Left status is counted only when marked in the source roster. Lessons use recorded calendar dates.':'Historical counts use available join/leave dates. Groups count groups with lessons that month; missing dates make student counts estimates.'}</p>
      <RetentionChart d={d} />
      <DashboardCharts d={d} month={month} showFinance={showFinance} />
    </>
  );
}

const pct = (value) => value == null ? "—" : `${Math.round(value)}%`;
const monthLabel = (value) => new Date(`${value}-01T00:00:00`).toLocaleDateString("en", { month: "short" });

function DashboardCharts({ d, month, showFinance }) {
  const [courseMonth, setCourseMonth] = useState("2");
  const [groupMetric, setGroupMetric] = useState("combined");
  const years = [...new Set([
    ...(d.payments || []).map((payment) => payment.payment_date?.slice(0, 4)),
    ...(showFinance ? (d.periods || []).map((period) => period.period_month?.slice(0, 4)) : []),
  ].filter(Boolean))].sort().reverse();
  const [yearChoice, setYearChoice] = useState("");
  const year = years.includes(yearChoice) ? yearChoice : years[0] || String(new Date().getFullYear());
  const teachers = topTeachersByRetention(d, courseMonth);
  const groups = topGroupsByPerformance(d, month, groupMetric);
  const finance = showFinance ? yearlyFinanceSeries(d, year) : null;
  const metricName = { combined: "Combined", attendance: "Attendance", homework: "Homework", assessment: "Assessment" }[groupMetric];
  const salaryMax = finance ? Math.max(1, ...Object.values(finance.salary)) : 1;
  const financialMax = finance ? Math.max(salaryMax, ...Object.values(finance.income)) : 1;
  return <div className="dashboard-chart-grid">
    <section className="panel chart-panel" aria-label="Top teachers by retention">
      <div className="chart-heading"><div><h2>Top 5 Teachers by Retention</h2><p className="hint">Weighted across the teacher’s groups at the selected course checkpoint.</p></div>
        <label>Checkpoint <select aria-label="Retention checkpoint" value={courseMonth} onChange={(event) => setCourseMonth(event.target.value)}><option value="2">M1 → M2</option><option value="3">M2 → M3</option></select></label>
      </div>
      {teachers.length ? teachers.map((teacher, index) => <div className="leader-row" key={teacher.teacherId}>
        <span className="leader-rank">{index + 1}</span><span className="leader-name">{teacher.name}<small>{teacher.retained} of {teacher.baseline} students · {teacher.groups} {teacher.groups === 1 ? "group" : "groups"}</small></span>
        <div className="retention-track"><div className="retention-fill" style={{ width: `${Math.min(100, teacher.retention)}%` }} role="progressbar" aria-label={`${teacher.name} retention`} aria-valuenow={Math.round(teacher.retention)} aria-valuemin="0" aria-valuemax="100" /></div><b>{pct(teacher.retention)}</b>
      </div>) : <p className="hint">No comparable retention records for this checkpoint yet.</p>}
    </section>

    <section className="panel chart-panel" aria-label="Top groups by performance">
      <div className="chart-heading"><div><h2>Top 5 Groups</h2><p className="hint">Performance for {month || "the selected month"}. Combined score averages available measures equally.</p></div>
        <label>Rank by <select aria-label="Group chart metric" value={groupMetric} onChange={(event) => setGroupMetric(event.target.value)}><option value="combined">Combined score</option><option value="attendance">Attendance</option><option value="homework">Homework</option><option value="assessment">Assessment</option></select></label>
      </div>
      {groups.length ? groups.map((group, index) => <div className="group-leader" key={group.groupId}>
        <div className="group-leader-title"><b>{index + 1}. {group.name}</b><strong>{pct(group[groupMetric])}</strong></div>
        <div className="retention-track"><div className="retention-fill" style={{ width: `${Math.min(100, group[groupMetric])}%` }} role="progressbar" aria-label={`${group.name} ${metricName.toLowerCase()} score`} aria-valuenow={Math.round(group[groupMetric])} aria-valuemin="0" aria-valuemax="100" /></div>
        <small>Attendance {pct(group.attendance)} · Homework {pct(group.homework)} · Assessment {pct(group.assessment)}</small>
      </div>) : <p className="hint">No recorded attendance, homework, or assessment results for this month yet.</p>}
    </section>

    {showFinance && <section className="panel chart-panel annual-chart" aria-label="Yearly income and salaries">
      <div className="chart-heading"><div><h2>Income and Salaries by Year</h2><p className="hint">Income uses dated cash payments. Salaries include approved payroll only.</p></div>
        <label>Year <select aria-label="Finance chart year" value={year} onChange={(event) => setYearChoice(event.target.value)}>{years.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      </div>
      <div className="annual-legend"><span><i className="legend-income" />Income</span><span><i className="legend-salary" />Approved salaries</span></div>
      <div className="annual-bars" role="img" aria-label={`${year} monthly income and approved salary chart`}>
        {finance.months.map((value) => <div className="annual-month" key={value} title={`${monthLabel(value)} ${year}: income ${finance.datedIncomeRows ? fmt(finance.income[value]) : "no dated records"}; salaries ${fmt(finance.salary[value])}`}>
          <div className="annual-bar-pair"><div className={finance.datedIncomeRows ? "annual-bar income-bar" : "annual-bar no-data-bar"} style={{ height: `${finance.datedIncomeRows ? Math.max(0, finance.income[value] / financialMax * 100) : 0}%` }} /><div className="annual-bar salary-bar" style={{ height: `${Math.max(0, finance.salary[value] / financialMax * 100)}%` }} /></div>
          <small>{monthLabel(value)}</small>
        </div>)}
      </div>
      {!finance.datedIncomeRows && <p className="hint">Income can’t be charted by month yet: existing cash payment records have no payment dates. New payments with dates will appear here.</p>}
    </section>}
  </div>;
}

function AdminAccess({ onInvited }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return <section className="panel admin-access">
    <h2>Invite an academic admin</h2>
    <p>They can manage students, groups, lessons, attendance, homework, and assessments. Payroll and finance are view-only.</p>
    <form onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setError(""); setMessage("");
      try {
        const profile = await inviteAcademicAdmin({ email: email.trim(), fullName: fullName.trim() });
        onInvited("profiles", profile);
        setMessage(`Invitation sent to ${email.trim()}. They can set a password from the email.`);
        setEmail(""); setFullName("");
      } catch (e) { setError(e.message); }
      finally { setBusy(false); }
    }}>
      <label>Full name <input required maxLength="120" value={fullName} onChange={(e) => setFullName(e.target.value)} /></label>
      <label>Email <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <button disabled={busy} type="submit">{busy ? "Sending…" : "Send invitation"}</button>
    </form>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
  </section>;
}

function RetentionChart({ d }) {
  const groups = (d.groups || []).map((g) => {
    const get = (month) => d.metrics?.find((m) => m.group_id === g.id && Number(m.course_month) === month);
    const m1 = get(1), m2 = get(2), m3 = get(3);
    const base1 = m1?.student_count ?? g.starting_enrollment;
    const a = retentionLabel(m2, base1), b = retentionLabel(m3, m2?.student_count);
    const values = [a, b].filter((x) => x !== "—").map((x) => Number.parseInt(x, 10));
    return { name: displayGroupName(g.name), active: g.active !== false, value: values.length ? Math.min(...values) : null };
  }).filter((g) => g.active && g.value != null).sort((a, b) => a.value - b.value).slice(0, 8);
  if (!groups.length) return <p className="hint">Retention chart appears when groups have comparable month-to-month roster data.</p>;
  return <section className="panel retention-chart" aria-label="Lowest group retention">
    <h2>Retention to review</h2>
    <p className="hint">Lowest recorded retention percentage per group. Red bars are below 50%.</p>
    {groups.map((g) => <div className="retention-row" key={g.name}>
      <span>{g.name}</span><div className="retention-track"><div className={g.value < 50 ? "retention-fill low" : "retention-fill"} style={{ width: `${Math.min(100, g.value)}%` }} role="progressbar" aria-label={`${g.name} retention`} aria-valuenow={g.value} aria-valuemin="0" aria-valuemax="100" /></div><b className={g.value < 50 ? "retention-low" : ""}>{g.value}%</b>
    </div>)}
  </section>;
}

function AcademicCell({ record, lessonId, studentId, type, label, onSaved }) {
  const [value, setValue] = useState(record?.status || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef(false);
  const options =
    type === "attendance"
      ? ["present", "absent"]
      : ["done", "partial", "missing"];
  async function save(next) {
    if (pending.current || !next || next === value) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const { data, error } = await sb
        .from(type)
        .upsert(
          { lesson_id: lessonId, student_id: studentId, status: next },
          { onConflict: "lesson_id,student_id" },
        )
        .select()
        .single();
      if (error) throw error;
      setValue(data.status);
      onSaved(data);
    } catch (e) {
      setError(e.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <select
        aria-label={label}
        value={value}
        disabled={busy}
        onChange={(e) => save(e.target.value)}
      >
        <option value="" disabled>
          —
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o[0].toUpperCase() + o.slice(1)}
          </option>
        ))}
      </select>
      {busy && <small role="status"> Saving…</small>}
      {error && (
        <small className="error" role="alert">
          {error}
        </small>
      )}
    </>
  );
}
function ScoreCells({ exam, student, record, onSaved }) {
  const [values, setValues] = useState({
    test_score: record?.test_score ?? "",
    speaking_score: record?.speaking_score ?? "",
  });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const saved = useRef(values),
    pending = useRef(false);
  async function save() {
    if (
      pending.current ||
      JSON.stringify(saved.current) === JSON.stringify(values)
    )
      return;
    if (
      Object.values(values).some(
        (v) =>
          v !== "" &&
          (!Number.isFinite(Number(v)) ||
            Number(v) < 0 ||
            Number(v) > Number(exam.max_score || 100)),
      )
    ) {
      setError("Score is outside the assessment range.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const payload = {
        exam_id: exam.id,
        student_id: student.id,
        score: record?.score ?? 0,
        test_score: values.test_score === "" ? null : Number(values.test_score),
        speaking_score:
          values.speaking_score === "" ? null : Number(values.speaking_score),
      };
      const { error } = await sb
        .from("exam_scores")
        .upsert(payload, { onConflict: "exam_id,student_id" })
        .select()
        .single();
      if (error) throw error;
      saved.current = { ...values };
      onSaved(payload);
    } catch (e) {
      setError(e.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="scorefields">
      {["test_score", "speaking_score"].map((field) => (
        <label key={field}>
          {field === "test_score" ? "Test" : "Speaking"}{" "}
          <input
            className="score"
            aria-label={`${student.full_name} ${field === "test_score" ? "Test" : "Speaking"}`}
            type="number"
            min="0"
            max={exam.max_score || 100}
            value={values[field]}
            disabled={busy}
            onChange={(e) =>
              setValues((old) => ({ ...old, [field]: e.target.value }))
            }
          />
        </label>
      ))}
      <button disabled={busy} onClick={save}>
        {busy ? "Saving…" : "Save scores"}
      </button>
      {error && (
        <small className="error" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}

export function AcademicSheet({ g, d, back, addLesson, onRecordSaved }) {
  const [editingLesson, setEditingLesson] = useState(null);
  const [editedRecords, setEditedRecords] = useState({}),
    [editedScores, setEditedScores] = useState({});
  const [monthChoice, setMonth] = useState(""),
    [lessonChoice, setLesson] = useState(""),
    [examChoice, setExam] = useState("");
  const [showAssessment, setShowAssessment] = useState(false),
    [name, setName] = useState("Assessment"),
    [date, setDate] = useState(localDate),
    [extraExams, setExtraExams] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef(false);
  if (!g)
    return (
      <>
        <button onClick={back}>← Groups</button>
        <p>Group could not be loaded. Please return to Groups.</p>
      </>
    );
  const lessons = courseLessons(d.lessons, g.id);
  const exams = [
    ...d.exams,
    ...extraExams.filter((e) => !d.exams.some((x) => x.id === e.id)),
  ].filter((x) => x.group_id === g.id);
  const months = monthsOf([
    ...lessons.map(dateOfLesson),
    ...exams.map((x) => x.exam_date),
    ...(d.rosters||[]).filter(r=>r.group_id===g.id).map(r=>r.period_month),
  ]);
  const month = months.includes(monthChoice) ? monthChoice : months[0] || "";
  const visible = lessons.filter((x) => dateOfLesson(x).startsWith(month));
  const selected = visible.find((x) => x.id === lessonChoice) || visible.at(-1);
  const monthExams = exams
    .filter((x) => (x.exam_date || "").startsWith(month))
    .sort((a, b) => (a.exam_date || "").localeCompare(b.exam_date || ""));
  const exam = monthExams.find((x) => x.id === examChoice) || monthExams.at(-1);
  const monthRoster=(d.rosters||[]).filter(r=>r.group_id===g.id&&r.period_month.startsWith(month));
  const studentIds = new Set(monthRoster.length?monthRoster.map(r=>r.student_id):d.members.filter((x) => x.group_id === g.id).map((x) => x.student_id));
  const students = d.students
    .filter((s) => studentIds.has(s.id))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  async function createAssessment(e) {
    e.preventDefault();
    if (pending.current) return;
    if (!name.trim() || !validDate(date)) {
      setError("Enter an assessment name and valid date.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const { data, error } = await sb
        .from("exams")
        .insert({
          group_id: g.id,
          name: name.trim(),
          exam_date: date,
          max_score: 100,
        })
        .select()
        .single();
      if (error) throw error;
      setExtraExams((old) => [...old, data]);
      onRecordSaved?.("exams", data);
      setMonth(date.slice(0, 7));
      setExam(data.id);
      setShowAssessment(false);
    } catch (e) {
      setError(e.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <div className="formbar">
        <button onClick={back}>← Groups</button>
        <h3>{displayGroupName(g.name)} — Academic Sheet</h3>
        <label>
          Month{" "}
          <select
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setLesson("");
              setExam("");
            }}
          >
            {months.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label>
          Lesson{" "}
          <select
            value={selected?.id || ""}
            disabled={!selected}
            onChange={(e) => setLesson(e.target.value)}
          >
            {visible.map((x) => (
              <option key={x.id} value={x.id}>
                L{x.lesson_number} · {dateOfLesson(x)} ·{" "}
                {x.is_review ? "Review · LIVE only" : x.payroll_payable ? "Payable" : "Unpaid"}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => addLesson(g)}>+ Add Lesson</button>
        <button disabled={!selected} onClick={() => setEditingLesson(selected)}>✎ Edit lesson</button>
        <button onClick={() => setShowAssessment((v) => !v)}>
          + Assessment
        </button>
      </div>
      {editingLesson && <LessonEditor key={editingLesson.id} group={g} lessons={d.lessons} lesson={editingLesson}
        onCancel={() => setEditingLesson(null)}
        onSaved={row => {onRecordSaved?.("lessons", row);setMonth(row.lesson_date.slice(0,7));setLesson(row.id);setEditingLesson(null);}} />}
      {showAssessment && (
        <form className="formbar" onSubmit={createAssessment}>
          <label>
            Name{" "}
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Date{" "}
            <input
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <button disabled={busy}>
            {busy ? "Saving…" : "Save assessment"}
          </button>
          <button type="button" onClick={() => setShowAssessment(false)}>
            Cancel
          </button>
        </form>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="lessonstrip">
        {visible.map((x) => (
          <button
            key={x.id}
            className={selected?.id === x.id ? "onlesson" : ""}
            onClick={() => setLesson(x.id)}
          >
            L{x.lesson_number}
            <small>{dateOfLesson(x)}</small>
          </button>
        ))}
      </div>
      {!selected && <p>No lessons in this month.</p>}
      <Table
        heads={["Student", "LIVE", "HW"]}
        rows={students.map((s) => [
          s.full_name,
          ...["attendance", "homework"].map((type) =>
            selected ? (
              <AcademicCell
                key={`${selected.id}:${s.id}:${type}`}
                lessonId={selected.id}
                studentId={s.id}
                type={type}
                label={`${s.full_name} ${type === "attendance" ? "LIVE" : "HW"}`}
                record={
                  editedRecords[`${selected.id}:${s.id}:${type}`] ||
                  d[type].find(
                    (x) => x.lesson_id === selected.id && x.student_id === s.id,
                  )
                }
                onSaved={(record) => {
                  setEditedRecords((old) => ({
                    ...old,
                    [`${selected.id}:${s.id}:${type}`]: record,
                  }));
                  onRecordSaved?.(type, record);
                }}
              />
            ) : (
              "—"
            ),
          ),
        ])}
      />
      <div className="formbar">
        <label>
          Assessment{" "}
          <select
            value={exam?.id || ""}
            disabled={!exam}
            onChange={(e) => setExam(e.target.value)}
          >
            {monthExams.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} · {x.exam_date}
              </option>
            ))}
          </select>
        </label>
      </div>
      {exam ? (
        <Table
          heads={["Student", "Test / Speaking"]}
          rows={students.map((s) => [
            s.full_name,
            <ScoreCells
              key={`${exam.id}:${s.id}`}
              exam={exam}
              student={s}
              record={
                editedScores[`${exam.id}:${s.id}`] ||
                d.scores.find(
                  (x) => x.exam_id === exam.id && x.student_id === s.id,
                )
              }
              onSaved={(record) => {
                setEditedScores((old) => ({
                  ...old,
                  [`${exam.id}:${s.id}`]: record,
                }));
                onRecordSaved?.("scores", record);
              }}
            />,
          ])}
        />
      ) : (
        <p>No assessment in this month.</p>
      )}
    </>
  );
}

export function Payroll({ d }) {
  const periods = d.periods
    .slice()
    .sort((a, b) => b.period_month.localeCompare(a.period_month));
  const [choice, setChoice] = useState("");
  const period = periods.find((x) => x.id === choice) || periods[0];
  const rows = d.payroll.filter((x) => x.payroll_period_id === period?.id),
    total = payrollTotal(rows);
  return (
    <>
      <div className="formbar">
        <h3>Teacher Payroll</h3>
        <label>
          Period{" "}
          <select
            value={period?.id || ""}
            onChange={(e) => setChoice(e.target.value)}
          >
            {periods.map((x) => (
              <option key={x.id} value={x.id}>
                {x.period_month} · {x.status}
              </option>
            ))}
          </select>
        </label>
        <strong>Total Salary: {fmt(total)}</strong>
        <span>Stored payroll amounts</span>
      </div>
      <div className="cards salarycards">
        {[
          ["fixed_amount", "Fixed"],
          ["attendance_amount", "Attendance"],
          ["homework_amount", "Homework"],
          ["assessment_bonus", "Assessment"],
        ].map(([field, title]) => (
          <Card
            key={field}
            n={fmt(rows.reduce((sum, row) => sum + Number(row[field] || 0), 0))}
            t={title}
          />
        ))}
      </div>
      <Table
        heads={[
          "Teacher",
          "Group",
          "Students",
          "Payable Lessons",
          "Fixed",
          "Attendance",
          "HW",
          "Assessment",
          "Retention",
          "Jarima",
          "Calculation",
          "Total",
        ]}
        rows={rows.map((x) => [
          d.teachers.find((t) => t.id === x.teacher_id)?.name || "—",
          displayGroupName(d.groups.find((g) => g.id === x.group_id)?.name || "—"),
          x.active_students,
          x.completed_lessons,
          fmt(x.fixed_amount),
          fmt(x.attendance_amount),
          fmt(x.homework_amount),
          fmt(x.assessment_bonus),
          fmt(x.retention_bonus),
          fmt(x.jarima_amount),
          <details>
            <summary>How</summary>
            <div className="calculation">
              {[
                ["fixed_amount", "Fixed"],
                ["attendance_amount", "Attendance"],
                ["homework_amount", "HW"],
                ["assessment_bonus", "Assessment"],
                ["retention_bonus", "Retention"],
                ["adjustments", "Adjustments"],
                ["cover_transfer", "Cover transfer"],
              ].map(([field, label]) => (
                <p key={field}>
                  {label}: {fmt(x[field])}
                </p>
              ))}
              <p>Component sum: {fmt(payrollPartsTotal(x))}</p>
              <p>Stored total: {fmt(x.total_amount)}</p>
              {x.payroll_note && <p>Note: {x.payroll_note}</p>}
              {Math.abs(payrollPartsTotal(x) - Number(x.total_amount || 0)) >
                0.5 && (
                <p className="error">
                  Difference to review:{" "}
                  {fmt(Number(x.total_amount || 0) - payrollPartsTotal(x))}
                </p>
              )}
              <p>
                Jarima shown separately: {fmt(x.jarima_amount)}. It is not
                deducted again here.
              </p>
            </div>
          </details>,
          <b>{fmt(x.total_amount)}</b>,
        ])}
      />
      <p className="hint">
        This view explains stored payroll components. It does not recalculate or
        save payroll. Rate and penalty rules must be verified against the
        database calculation before changing approved totals.
      </p>
    </>
  );
}

export function Finance({ d, refresh, onRecordSaved, readOnly = false }) {
  const [show, setShow] = useState(false),
    [gid, setGid] = useState(""),
    [sid, setSid] = useState(""),
    [date, setDate] = useState(localDate),
    [amount, setAmount] = useState(""),
    [cm, setCm] = useState("1"),
    [note, setNote] = useState(""),
    [month, setMonth] = useState("All");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [saved, setSaved] = useState([]);
  const pending = useRef(false);
  const payments = [
    ...d.payments,
    ...saved.filter((s) => !d.payments.some((x) => x.id === s.id)),
  ];
  const cash = paymentRows(payments, "All"),
    shown = paymentRows(payments, month);
  const months = [
    ...monthsOf([
      ...Array.from({ length: 12 }, (_, i) => {
        const date = new Date();
        date.setDate(1);
        date.setMonth(date.getMonth() - i);
        return date.toISOString().slice(0, 7);
      }),
      ...cash.map((x) => x.payment_date),
    ]),
    ...(cash.some((x) => !x.payment_date) ? ["Undated"] : []),
  ];
  const [groupFilter, setGroupFilter] = useState("All");
  const [intakeFilter, setIntakeFilter] = useState("All");
  const [sortBy, setSortBy] = useState("date");
  const activeStudentIds = new Set(d.students.filter((s) => s.status === "active").map((s) => s.id));
  const ids = new Set(
    d.members.filter((x) => x.group_id === gid && x.active !== false).map((x) => x.student_id),
  );
  const students = d.students.filter((s) => ids.has(s.id) && activeStudentIds.has(s.id)).sort((a, b) => a.full_name.localeCompare(b.full_name));
  const listedPayments = shown.filter((p) => {
    const group = d.groups.find((g) => g.id === p.group_id);
    return (groupFilter === "All" || p.group_id === groupFilter) && (intakeFilter === "All" || group?.intake_id === intakeFilter);
  });
  const undatedPaymentCount = cash.filter((p) => !p.payment_date).length;
  const orderedPayments = listedPayments.slice().sort((a, b) => {
    if (sortBy === "group") {
      const name = (id) => displayGroupName(d.groups.find((g) => g.id === id)?.name || "");
      return name(a.group_id).localeCompare(name(b.group_id)) || (b.payment_date || "").localeCompare(a.payment_date || "");
    }
    if (sortBy === "intake") {
      const name = (id) => d.intakes.find((i) => i.id === d.groups.find((g) => g.id === id)?.intake_id)?.name || "";
      return name(a.group_id).localeCompare(name(b.group_id)) || (b.payment_date || "").localeCompare(a.payment_date || "");
    }
    return (b.payment_date || "").localeCompare(a.payment_date || "");
  });
  async function save(e) {
    e.preventDefault();
    if (pending.current) return;
    setError("");
    setMessage("");
    let payload;
    try {
      payload = paymentPayload({ gid, sid, date, amount, cm, note }, d.members);
    } catch (e) {
      setError(e.message);
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      const { data, error } = await sb
        .from("student_payments")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      setSaved((old) => [...old, data]);
      onRecordSaved?.("payments", data);
      setMonth(date.slice(0, 7));
      setShow(false);
      setAmount("");
      setNote("");
      setMessage("Payment saved.");
    } catch (e) {
      setError(
        `Payment could not be confirmed. ${e.message}. Check the payment list before retrying.`,
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <div className="cards">
        <Card n={listedPayments.length} t="Cash payments" />
        <Card
          n={fmt(listedPayments.reduce((sum, x) => sum + Number(x.amount || 0), 0))}
          t="Collected"
        />
      </div>
      <div className="formbar">
        <h3>Student Payments</h3>
        <label>
          Payment month{" "}
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="All">All months</option>
            {months.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label>Group <select aria-label="Filter payments by group" value={groupFilter} onChange={e=>setGroupFilter(e.target.value)}><option value="All">All groups</option>{d.groups.map(g=><option key={g.id} value={g.id}>{displayGroupName(g.name)}</option>)}</select></label>
        <label>Intake <select aria-label="Filter payments by intake" value={intakeFilter} onChange={e=>setIntakeFilter(e.target.value)}><option value="All">All intakes</option>{d.intakes.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
        <label>Sort by <select aria-label="Sort payments by" value={sortBy} onChange={e=>setSortBy(e.target.value)}><option value="date">Date</option><option value="group">Group</option><option value="intake">Intake</option></select></label>
        {readOnly ? <span className="hint">View only</span> : <button onClick={() => setShow((v) => !v)}>+ Add Payment</button>}
        {refresh && (
          <button disabled={busy} onClick={refresh}>
            Refresh payments
          </button>
        )}
      </div>
      {message && <p role="status">{message}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {show && !readOnly && (
        <form className="formbar" onSubmit={save}>
          <label>
            Group{" "}
            <select
              required
              value={gid}
              onChange={(e) => {
                setGid(e.target.value);
                setSid("");
              }}
            >
              <option value="">Choose group</option>
              {d.groups.filter(g=>g.active!==false).map((g) => (
                <option key={g.id} value={g.id}>
                  {displayGroupName(g.name)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Student{" "}
            <select
              required
              disabled={!gid}
              value={sid}
              onChange={(e) => setSid(e.target.value)}
            >
              <option value="">Choose student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date{" "}
            <input
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Amount{" "}
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label>
            Course Month{" "}
            <select value={cm} onChange={(e) => setCm(e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i + 1}>
                  Course month {i + 1}
                </option>
              ))}
            </select>
          </label>
          <label>
            Note{" "}
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button disabled={busy}>{busy ? "Saving…" : "Save Payment"}</button>
          <button type="button" disabled={busy} onClick={() => setShow(false)}>
            Cancel
          </button>
        </form>
      )}
      <Table
        heads={["Student", "Group", "Date", "Course Month", "Amount", "Note"]}
        rows={orderedPayments
          .map((x) => [
            d.students.find((s) => s.id === x.student_id)?.full_name || "—",
            displayGroupName(d.groups.find((g) => g.id === x.group_id)?.name || "—"),
            x.payment_date,
            x.course_month,
            fmt(x.amount),
            x.payment_note,
          ])}
      />
      {listedPayments.length === 0 && (
        <p role="status">
          {month !== "All" && month !== "Undated" && undatedPaymentCount > 0
            ? `No payments dated ${month} match these filters. ${undatedPaymentCount} historical payment${undatedPaymentCount === 1 ? " has" : "s have"} no payment date; choose Undated to view them.`
            : "No payments match these filters."}
        </p>
      )}
    </>
  );
}
