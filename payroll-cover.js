import { PAYROLL_RATES } from "./payroll-preview.js";

// A covered lesson moves earnings from the owner to the substitute exactly once.
export function calculateCoverTransfers({ month, groupId, ownerTeacherId, lessons, enrollments, attendance, homework, covers }) {
  const eligible = (studentId, day) => enrollments.some(e =>
    e.group_id === groupId && e.student_id === studentId &&
    e.joined_at && String(e.joined_at).slice(0, 10) <= day &&
    (!e.left_at || String(e.left_at).slice(0, 10) >= day));
  const byLesson = new Map();
  for (const cover of covers) {
    if (byLesson.has(cover.lesson_id)) throw new Error("Duplicate cover lesson");
    if (!cover.substitute_teacher_id || cover.substitute_teacher_id === ownerTeacherId)
      throw new Error("Cover requires a different teacher");
    byLesson.set(cover.lesson_id, cover);
  }
  const transfers = new Map([[ownerTeacherId, 0]]);
  for (const lesson of lessons) {
    if (lesson.group_id !== groupId || String(lesson.lesson_date).slice(0, 7) !== month) continue;
    const cover = byLesson.get(lesson.id);
    if (!cover) continue;
    if (lesson.payroll_payable !== true) throw new Error("Non-payable lesson cannot be covered for pay");
    const day = String(lesson.lesson_date).slice(0, 10);
    const students = new Set(enrollments.filter(e => e.group_id === groupId && eligible(e.student_id, day)).map(e => e.student_id));
    const fixed = students.size * PAYROLL_RATES.fixedPerStudentCourse / PAYROLL_RATES.lessonsPerCourse;
    const present = new Set(attendance.filter(a => a.lesson_id === lesson.id && students.has(a.student_id) && String(a.status).toLowerCase() === "present").map(a => a.student_id));
    const done = new Set(homework.filter(h => h.lesson_id === lesson.id && students.has(h.student_id) && String(h.status).toLowerCase() === "done").map(h => h.student_id));
    const value = fixed + present.size * PAYROLL_RATES.present + done.size * PAYROLL_RATES.homeworkDone;
    transfers.set(ownerTeacherId, (transfers.get(ownerTeacherId) || 0) - value);
    transfers.set(cover.substitute_teacher_id, (transfers.get(cover.substitute_teacher_id) || 0) + value);
  }
  for (const id of byLesson.keys()) {
    if (!lessons.some(l => l.id === id && l.group_id === groupId && String(l.lesson_date).startsWith(month)))
      throw new Error("Cover lesson outside payroll month");
  }
  return Object.fromEntries(transfers);
}
