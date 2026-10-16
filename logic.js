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
  return (
    lessons
      .filter((x) => x.group_id === groupId)
      .reduce((max, x) => Math.max(max, Number(x.lesson_number) || 0), 0) + 1
  );
}
export function dashboardCounts(d, month) {
  if (!month) return { active: 0, left: 0, groups: 0, lessons: 0 };
  const lessons = d.lessons.filter((x) => dateOfLesson(x).startsWith(month));
  // Count participation during the month, including students who left later in it.
  // Current status alone cannot reconstruct a historical month.
  const active = d.students.filter((s) => {
    const joined = (s.joined_at || "").slice(0, 10);
    const left = (s.left_at || "").slice(0, 10);
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
    "cover_transfer",
  ].reduce((sum, field) => sum + Number(row[field] || 0), 0);
export const approvedPayroll = { "2026-08": 8432332, "2026-09": 6442833 };
