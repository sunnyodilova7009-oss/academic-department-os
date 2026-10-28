export const retentionLabel = (metric, previousCount) => {
  if (metric?.baseline_from_previous > 0 && metric.retained_from_previous != null) {
    return Math.round(metric.retained_from_previous / metric.baseline_from_previous * 100) + "%";
  }
  // A sourced roster without a matched prior cohort cannot establish retention.
  if (metric?.source_spreadsheet || !(previousCount > 0) || metric?.student_count == null || metric.student_count > previousCount) return "—";
  return Math.round(metric.student_count / previousCount * 100) + "%";
};
export const dateOfLesson = (lesson) => lesson.lesson_date || lesson.date || "";
export const monthsOf = (dates) =>
  [...new Set(dates.filter(Boolean).map((x) => x.slice(0, 7)))]
    .sort()
    .reverse();
export const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
export function validDate(value) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function nextLessonNumber(lessons, groupId) {
  return Math.max(0, ...courseLessons(lessons, groupId).map(l => l.lesson_number)) + 1;
}
// Historical imports can restart their source numbers each month. Keep the
// stored IDs and numbers intact while presenting one course-wide sequence.
export function courseLessons(lessons, groupId) {
  let previous = 0;
  return lessons.filter(x => x.group_id === groupId).slice().sort((a, b) =>
    (a.numbering_date || dateOfLesson(a)).localeCompare(b.numbering_date || dateOfLesson(b)) || Number(a.lesson_number || 0) - Number(b.lesson_number || 0) || String(a.id).localeCompare(String(b.id))
  ).map(lesson => {
    previous = Math.max(previous + 1, Number(lesson.lesson_number) || 0);
    return { ...lesson, lesson_number: lesson.course_number ?? previous };
  }).sort((a,b) => dateOfLesson(a).localeCompare(dateOfLesson(b)) || a.lesson_number-b.lesson_number || String(a.id).localeCompare(String(b.id)));
}
export function dashboardCounts(d, month) {
  if (!month) return { active: 0, left: 0, groups: 0, lessons: 0 };
  const lessons = d.lessons.filter((x) => dateOfLesson(x).startsWith(month));
  const roster=(d.rosters||[]).filter(r=>r.period_month.startsWith(month));
  if(roster.length){const active=new Set(roster.filter(r=>r.status==='active').map(r=>r.student_id)),left=new Set(roster.filter(r=>r.status==='left').map(r=>r.student_id));return {active:active.size,left:[...left].filter(id=>!active.has(id)).length,groups:new Set(roster.filter(r=>r.status==='active').map(r=>r.group_id)).size,lessons:lessons.length};}
  const history = (d.rosterHistory || []).filter((r) =>
    String(r.source_type || r.source_month || "").startsWith(month),
  );
  if (history.length) {
    const inactive = (status) => /left|stopped|inactive|graduated|transferred/i.test(status || "");
    const activeRows = history.filter((r) => !inactive(r.source_status));
    const active = new Set(activeRows.map((r) => r.student_id).filter(Boolean));
    const left = new Set(history.filter((r) => inactive(r.source_status)).map((r) => r.student_id).filter(Boolean));
    return {
      active: active.size,
      left: [...left].filter((id) => !active.has(id)).length,
      groups: new Set(activeRows.map((r) => r.group_id).filter(Boolean)).size,
      lessons: lessons.length,
    };
  }
  // Count participation during the month, including students who left later in it.
  // Current status alone cannot reconstruct a historical month.
  const active = d.students.filter((s) => {
    const joined = (s.joined_at || "").slice(0, 10);
    const left = (s.left_at || "").slice(0, 10);
    // When an imported inactive record has no exit date, its historical
    // enrollment is unknown. Do not silently count it as currently active.
    if (!left && ['left','paused','graduated'].includes(s.status)) return false;
    return (
      (!joined || joined.slice(0, 7) <= month) &&
      (!left || left.slice(0, 7) >= month)
    );
  }).length;
  return {
    active,
    left: d.students.filter((s) => (s.left_at || "").startsWith(month)).length,
    groups: new Set(lessons.map((x) => x.group_id).filter(Boolean)).size,
    lessons: lessons.length,
  };
}
export function paymentRows(payments, month) {
  return payments.filter(
    (x) =>
      x.counts_as_cash_payment !== false &&
      (month === "All" ||
        (month === "Undated"
          ? !x.payment_date
          : (x.payment_date || "").startsWith(month))),
  );
}
export function paymentPayload({ gid, sid, date, amount, cm, note }, members) {
  if (
    !gid ||
    !sid ||
    !members.some((m) => m.group_id === gid && m.student_id === sid)
  )
    throw new Error("Choose a student in the selected group.");
  if (!validDate(date)) throw new Error("Enter a valid payment date.");
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0)
    throw new Error("Amount must be greater than zero.");
  if (!Number.isInteger(Number(cm)) || Number(cm) < 1 || Number(cm) > 12)
    throw new Error("Choose a course month from 1 to 12.");
  return {
    group_id: gid,
    student_id: sid,
    payment_date: date,
    amount: Number(amount),
    course_month: Number(cm),
    payment_note: note.trim() || null,
    payment_kind: "monthly",
    counts_as_cash_payment: true,
  };
}
export const payrollTotal = (rows) =>
  rows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
export const payrollPartsTotal = (row) =>
  [
    "fixed_amount",
    "attendance_amount",
    "homework_amount",
    "assessment_bonus",
    "retention_bonus",
    "adjustments",
  ].reduce((sum, field) => sum + Number(row[field] || 0), 0) - Number(row.cover_transfer || 0);
export const approvedPayroll = { "2026-08": 8432332, "2026-09": 11467346 };

const percent = (value, total) => total > 0 ? value / total * 100 : null;

export function groupPerformance(d, month) {
  if (!month) return [];
  const lessons = (d.lessons || []).filter((lesson) => dateOfLesson(lesson).startsWith(month));
  const exams = (d.exams || []).filter((exam) => (exam.exam_date || "").startsWith(month));
  const examIds = new Set(exams.map((exam) => exam.id));
  return (d.groups || []).map((group) => {
    const groupLessonIds = new Set(lessons.filter((lesson) => lesson.group_id === group.id).map((lesson) => lesson.id));
    const groupExamIds = new Set(exams.filter((exam) => exam.group_id === group.id).map((exam) => exam.id));
    const attendance = (d.attendance || []).filter((row) => groupLessonIds.has(row.lesson_id) && ["present", "absent"].includes(row.status));
    const homework = (d.homework || []).filter((row) => groupLessonIds.has(row.lesson_id) && ["done", "partial", "missing"].includes(row.status));
    let assessmentPoints = 0, possiblePoints = 0, assessments = 0;
    const examById = new Map(exams.filter((exam) => groupExamIds.has(exam.id)).map((exam) => [exam.id, exam]));
    for (const row of (d.scores || [])) {
      const exam = examById.get(row.exam_id);
      if (!exam || !examIds.has(row.exam_id)) continue;
      const maxScore = Number(exam.max_score || 100);
      const components = [row.test_score, row.speaking_score].filter((value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)));
      if (components.length) {
        assessmentPoints += components.reduce((sum, value) => sum + Number(value), 0);
        possiblePoints += maxScore * components.length;
        assessments += components.length;
      } else if (row.score !== null && row.score !== undefined && Number(row.score) > 0 && Number.isFinite(Number(row.score))) {
        assessmentPoints += Number(row.score);
        possiblePoints += maxScore;
        assessments += 1;
      }
    }
    const attendanceRate = percent(attendance.filter((row) => row.status === "present").length, attendance.length);
    const homeworkRate = percent(homework.filter((row) => ["done", "partial"].includes(row.status)).length, homework.length);
    const assessmentRate = percent(assessmentPoints, possiblePoints);
    const available = [attendanceRate, homeworkRate, assessmentRate].filter((value) => value !== null);
    return {
      groupId: group.id,
      name: displayGroupName(group.name),
      attendance: attendanceRate,
      homework: homeworkRate,
      assessment: assessmentRate,
      combined: available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : null,
      attendanceRecords: attendance.length,
      homeworkRecords: homework.length,
      assessmentRecords: assessments,
    };
  }).filter((row) => row.combined !== null);
}

export function topGroupsByPerformance(d, month, metric = "combined", limit = 5) {
  return groupPerformance(d, month)
    .filter((row) => row[metric] !== null && Number.isFinite(row[metric]))
    .sort((a, b) => b[metric] - a[metric] || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function topTeachersByRetention(d, courseMonth, limit = 5) {
  const teachers = new Map((d.teachers || []).map((teacher) => [teacher.id, teacher.name]));
  const groups = new Map((d.groups || []).map((group) => [group.id, group.teacher_id]));
  const totals = new Map();
  for (const metric of (d.metrics || [])) {
    const baseline = Number(metric.baseline_from_previous);
    const retained = Number(metric.retained_from_previous);
    const teacherId = groups.get(metric.group_id);
    if (Number(metric.course_month) !== Number(courseMonth) || !(baseline > 0) || !Number.isFinite(retained) || !teacherId || !teachers.has(teacherId)) continue;
    const row = totals.get(teacherId) || { teacherId, name: teachers.get(teacherId), retained: 0, baseline: 0, groups: new Set() };
    row.retained += retained;
    row.baseline += baseline;
    row.groups.add(metric.group_id);
    totals.set(teacherId, row);
  }
  return [...totals.values()].map((row) => ({
    teacherId: row.teacherId,
    name: row.name,
    retention: percent(row.retained, row.baseline),
    retained: row.retained,
    baseline: row.baseline,
    groups: row.groups.size,
  })).sort((a, b) => b.retention - a.retention || a.name.localeCompare(b.name)).slice(0, limit);
}

export function yearlyFinanceSeries(d, year) {
  const prefix = String(year);
  const months = Array.from({ length: 12 }, (_, index) => `${prefix}-${String(index + 1).padStart(2, "0")}`);
  const income = Object.fromEntries(months.map((month) => [month, 0]));
  const salary = Object.fromEntries(months.map((month) => [month, 0]));
  let datedIncomeRows = 0;
  for (const payment of (d.payments || [])) {
    if (payment.counts_as_cash_payment === false || !(payment.payment_date || "").startsWith(prefix)) continue;
    const month = payment.payment_date.slice(0, 7);
    if (month in income) {
      income[month] += Number(payment.amount || 0);
      datedIncomeRows++;
    }
  }
  const approvedPeriods = new Set((d.periods || []).filter((period) => period.status === "approved" && (period.period_month || "").startsWith(prefix)).map((period) => period.id));
  for (const row of (d.payroll || [])) {
    if (!approvedPeriods.has(row.payroll_period_id)) continue;
    const period = (d.periods || []).find((candidate) => candidate.id === row.payroll_period_id);
    const month = period?.period_month?.slice(0, 7);
    if (month in salary) salary[month] += Number(row.total_amount || 0);
  }
  return { months, income, salary, datedIncomeRows };
}

export function displayGroupName(name = "") {
  return String(name).replace(/\b(pre[- ]inter(?:mediate)?|upper[- ]?inter(?:mediate)?|inter(?:mediate)?|elementary|beginner)\b/ig, (match) => {
    const key = match.toLowerCase().replace(/\s/g, "");
    return key.startsWith("pre") ? "Pre-intermediate" : key.startsWith("upper") ? "Upper-intermediate" : key.startsWith("inter") ? "Intermediate" : key[0].toUpperCase() + key.slice(1);
  });
}
