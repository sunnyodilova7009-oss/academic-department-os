import React, { useEffect, useRef, useState } from "react";
import { sb, tables, readAll } from "./client.js";
import {
  approvedPayroll,
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
  validDate,
} from "./logic.js";

const nav = [
  "Dashboard",
  "Students",
  "Groups",
  "Support",
  "Payroll",
  "Finance",
];
const emptyData = Object.fromEntries(
  Object.keys(tables).map((key) => [key, []]),
);
const fmt = (value) => Number(value || 0).toLocaleString("en-US");
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
    Promise.all(
      Object.entries(tables).map(async ([key, table]) => [
        key,
        await readAll(table),
      ]),
    )
      .then((entries) => {
        if (alive) setData(Object.fromEntries(entries));
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
  if (!authReady)
    return (
      <main>
        <p role="status">Checking sign-in…</p>
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
          {error && <p role="alert">{error}</p>}
        </form>
      </main>
    );
  return (
    <div className="app">
      <aside>
        <h2>Academic OS</h2>
        {nav.map((name) => (
          <button
            key={name}
            className={page === name ? "on" : ""}
            onClick={() => setPage(name)}
          >
            {name}
          </button>
        ))}
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
              <Dashboard d={data} />
            ) : page === "Students" ? (
              <Students d={data} refresh={refresh} onRecordSaved={recordSaved} />
            ) : page === "Groups" ? (
              <Groups d={data} onRecordSaved={recordSaved} />
            ) : page === "Support" ? (
              <section className="panel">
                <h2>Support</h2>
                <p>On progress</p>
              </section>
            ) : page === "Payroll" ? (
              <Payroll d={data} />
            ) : (
              <Finance d={data} refresh={refresh} onRecordSaved={recordSaved} />
            )}
          </React.Fragment>
        )}
      </main>
    </div>
  );
}

export function Dashboard({ d }) {
  const months = monthsOf([
    ...d.lessons.map(dateOfLesson),
    ...d.students.flatMap((s) => [s.joined_at, s.left_at]),
    ...d.periods.map((p) => p.period_month),
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
    </>
  );
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
        <button onClick={() => setShowAssessment((v) => !v)}>
          + Assessment
        </button>
      </div>
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
  const approved = approvedPayroll[period?.period_month?.slice(0, 7)];
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
      {approved !== undefined && (
        <p className={Math.round(total) === approved ? "verified" : "error"} role="status">
          {total === approved
            ? `Matches approved total: ${fmt(approved)}`
            : `Stored total ${fmt(total)} differs from approved ${fmt(approved)}. No payroll amounts have been changed.`}
        </p>
      )}
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

export function Finance({ d, refresh, onRecordSaved }) {
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
        <Card n={shown.length} t="Cash payments" />
        <Card
          n={fmt(shown.reduce((sum, x) => sum + Number(x.amount || 0), 0))}
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
        <button onClick={() => setShow((v) => !v)}>+ Add Payment</button>
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
      {show && (
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
    </>
  );
}
