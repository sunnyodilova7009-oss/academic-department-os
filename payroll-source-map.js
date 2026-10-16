import { calculatePayrollPreview } from "./payroll-preview.js";

// Read-only conversion of existing Supabase column names.
export function calculateFromAcademicRows(input) {
  const { month, groupId, teacherId, lessons, members, attendance, homework } = input;
  return calculatePayrollPreview({
    month, groupId, teacherId,
    lessons: lessons.map(row => ({
      id: row.id, group_id: row.group_id, lesson_date: row.lesson_date,
      payable: row.payroll_payable === true,
    })),
    enrollments: members.map(row => ({
      group_id: row.group_id, student_id: row.student_id,
      joined_at: row.joined_at, left_at: row.left_at,
    })),
    attendance, homework,
    assessments: (input.exams && input.scores) ? input.scores.filter(score => input.exams.some(exam => exam.id === score.exam_id && exam.group_id === groupId && String(exam.exam_date).startsWith(month))).map(score => {
      const exam = input.exams.find(exam => exam.id === score.exam_id);
      if (!(Number(exam.max_score) > 0) || score.score == null) throw new Error("Assessment needs score and positive max_score");
      return { assessment_id: score.exam_id, student_id: score.student_id, group_id: groupId, month, score: Number(score.score) * 100 / Number(exam.max_score) };
    }) : (input.assessments || []),
    retention: input.retention || [],
    adjustments: input.adjustments || 0,
    coverTransfers: input.coverTransfers || 0,
  });
}
