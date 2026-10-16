// Pure payroll preview: no database writes, no rounding of intermediate amounts.
// Inputs must be validated, normalized records from the existing database.
export const PAYROLL_RATES = Object.freeze({
  fixedPerStudentCourse: 50000, lessonsPerCourse: 12,
  present: 5000, homeworkDone: 3500,
});
export const HISTORICAL_LOCKED_MONTHS = Object.freeze({
  "2026-08": 8432332, "2026-09": 6442833,
});
const amount = (x) => {
  const n = Number(x);
  if (!Number.isFinite(n)) throw new Error("Invalid payroll number");
  return n;
};
const date = (x) => String(x || "").slice(0, 10);
const validMonth = (m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
const scoreBonus = (score) => score >= 90 ? 12000 : score >= 80 ? 8000 : score >= 70 ? 6000 : score >= 60 ? 4000 : 0;
const retentionRate = (percent) => percent >= 100 ? 20000 : percent >= 80 ? 15000 : percent >= 70 ? 12000 : percent >= 60 ? 8000 : 0;
const unique = (items, key) => {
  const seen = new Set();
  for (const item of items) {
    const id = key(item);
    if (seen.has(id)) throw new Error("Duplicate payroll source record: " + id);
    seen.add(id);
  }
};
// One teacher + group + calendar month. Enrollment dates are group-specific.
// Missing join date is rejected: guessing would overpay late joiners.
// Assessment scores are already normalized to 0..100 and grouped by student.
export function calculatePayrollPreview({
  month, groupId, teacherId, lessons = [], enrollments = [],
  attendance = [], homework = [], assessments = [],
  retention = [], adjustments = 0, coverTransfers = 0, coverAssignments = [],
}) {
  if (!validMonth(month) || !groupId || !teacherId) throw new Error("Payroll scope required");
  if (Object.hasOwn(HISTORICAL_LOCKED_MONTHS, month))
    throw new Error("Approved historical payroll is locked");
  const payable = lessons.filter(l => l.group_id === groupId &&
    date(l.lesson_date).slice(0, 7) === month && l.payable === true);
  unique(payable, l => l.id);
  const lessonIds = new Set(payable.map(l => l.id));
  unique(coverAssignments, a => a.lesson_id);
  const coverByLesson = new Map(coverAssignments.map(a => [a.lesson_id, a]));
  for (const cover of coverAssignments) {
    if (!lessonIds.has(cover.lesson_id)) throw new Error("Cover lesson must be payable in selected month");
    const coveredLesson = payable.find(l => l.id === cover.lesson_id);
    if (coveredLesson.teacher_id && coveredLesson.teacher_id !== cover.original_teacher_id)
      throw new Error("Cover original teacher does not match lesson owner");
    if (!cover.original_teacher_id || !cover.cover_teacher_id || cover.original_teacher_id === cover.cover_teacher_id)
      throw new Error("Cover assignment needs two distinct teachers");
  }
  const creditedToTeacher = lesson => {
    const cover = coverByLesson.get(lesson.id);
    return cover ? cover.cover_teacher_id === teacherId : lesson.teacher_id === teacherId;
  };
  unique(enrollments, e => e.student_id + ":" + e.group_id + ":" + date(e.joined_at));
  const members = enrollments.filter(e => e.group_id === groupId);
  if (members.some(e => !date(e.joined_at))) throw new Error("Enrollment joining date required");
  const eligible = (sid, day) => members.some(e => e.student_id === sid &&
    date(e.joined_at) && date(e.joined_at) <= day &&
    (!e.left_at || date(e.left_at) >= day));
  let fixed = 0;
  for (const lesson of payable) {
    if (!date(lesson.lesson_date)) throw new Error("Lesson date required");
    if (!creditedToTeacher(lesson)) continue;
    fixed += members.filter(e => eligible(e.student_id, date(lesson.lesson_date))).length *
      PAYROLL_RATES.fixedPerStudentCourse / PAYROLL_RATES.lessonsPerCourse;
  }
  const eligibleRecord = r => lessonIds.has(r.lesson_id) &&
    creditedToTeacher(payable.find(l => l.id === r.lesson_id)) &&
    eligible(r.student_id, date(payable.find(l => l.id === r.lesson_id)?.lesson_date));
  unique(attendance.filter(r => lessonIds.has(r.lesson_id)), r => r.lesson_id + ":" + r.student_id);
  unique(homework.filter(r => lessonIds.has(r.lesson_id)), r => r.lesson_id + ":" + r.student_id);
  const attendanceAmount = attendance.filter(r => eligibleRecord(r) && String(r.status).toLowerCase() === "present").length * PAYROLL_RATES.present;
  const homeworkAmount = homework.filter(r => eligibleRecord(r) && String(r.status).toLowerCase() === "done").length * PAYROLL_RATES.homeworkDone;
  const studentScores = new Map();
  unique(assessments.filter(a => a.group_id === groupId && a.month === month), a => a.assessment_id + ":" + a.student_id);
  for (const a of assessments) {
    if (a.group_id !== groupId || a.month !== month) continue;
    if (!members.some(e => e.student_id === a.student_id)) continue;
    const score = amount(a.score);
    if (score < 0 || score > 100) throw new Error("Assessment score outside 0–100");
    studentScores.set(a.student_id, [...(studentScores.get(a.student_id) || []), score]);
  }
  const assessmentBonus = [...studentScores.values()].reduce((sum, scores) =>
    sum + scoreBonus(scores.reduce((a, b) => a + b, 0) / scores.length), 0);
  unique(retention, r => r.checkpoint + ":" + r.group_id + ":" + r.month);
  let retentionBonus = 0;
  for (const checkpoint of retention) {
    if (checkpoint.group_id !== groupId || checkpoint.month !== month) continue;
    if (!["retention1", "retention2"].includes(checkpoint.checkpoint))
      throw new Error("Unknown retention checkpoint");
    const prev = amount(checkpoint.previousStudents), next = amount(checkpoint.retainedStudents);
    if (!Number.isInteger(prev) || !Number.isInteger(next) || prev <= 0 || next < 0 || next > prev)
      throw new Error("Invalid retention counts");
    retentionBonus += next * retentionRate(next / prev * 100);
  }
  const parts = {
    fixed_amount: fixed, attendance_amount: attendanceAmount,
    homework_amount: homeworkAmount, assessment_bonus: assessmentBonus,
    retention_bonus: retentionBonus, adjustments: amount(adjustments),
    cover_transfer: amount(coverTransfers),
  };
  const unrounded = Object.values(parts).reduce((sum, value) => sum + value, 0);
  return { month, groupId, teacherId, ...parts, total_unrounded: unrounded,
    total_amount: Math.round(unrounded), preview_only: true };
}
