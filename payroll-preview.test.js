import { describe, expect, it } from "vitest";
import { calculatePayrollPreview as calculate } from "./payroll-preview.js";
const base = {
  month: "2026-10", groupId: "g1", teacherId: "t1",
  lessons: Array.from({ length: 12 }, (_, i) => ({
    id: "l" + (i + 1), group_id: "g1",
    lesson_date: "2026-10-" + String(i + 1).padStart(2, "0"), payable: true,
  })),
  enrollments: [{ student_id: "s1", group_id: "g1", joined_at: "2026-10-06" }],
};
describe("salary preview", () => {
  it("pays only seven lessons after joining after lesson five", () => {
    const p = calculate(base);
    expect(p.fixed_amount).toBeCloseTo(50000 * 7 / 12);
    expect(p.total_amount).toBe(29167);
  });
  it("does not pay for review lessons", () => {
    const p = calculate({ ...base, lessons: base.lessons.map(l =>
      l.id === "l6" ? { ...l, payable: false } : l) });
    expect(p.fixed_amount).toBeCloseTo(25000);
  });
  it("counts only eligible present and done records", () => {
    const p = calculate({ ...base,
      attendance: [{ lesson_id: "l1", student_id: "s1", status: "Present" },
        { lesson_id: "l6", student_id: "s1", status: "Present" }],
      homework: [{ lesson_id: "l6", student_id: "s1", status: "Done" }],
    });
    expect(p.attendance_amount).toBe(5000);
    expect(p.homework_amount).toBe(3500);
  });
  it("averages all assessments before selecting a tier", () => {
    const p = calculate({ ...base, assessments: [
      { assessment_id: "a1", student_id: "s1", group_id: "g1", month: "2026-10", score: 100 },
      { assessment_id: "a2", student_id: "s1", group_id: "g1", month: "2026-10", score: 60 },
    ] });
    expect(p.assessment_bonus).toBe(8000);
  });
  it("pays retention only once per checkpoint", () => {
    const retention = [{ checkpoint: "retention1", group_id: "g1", month: "2026-10",
      previousStudents: 10, retainedStudents: 9 }];
    expect(calculate({ ...base, retention }).retention_bonus).toBe(135000);
    expect(() => calculate({ ...base, retention: [...retention, ...retention] })).toThrow(/Duplicate/);
  });
  it("preserves signed adjustments and rounds only final total", () => {
    const p = calculate({ ...base, adjustments: -1000.5, coverTransfers: 500 });
    expect(p.adjustments).toBe(-1000.5);
    expect(p.total_amount).toBe(Math.round(50000 * 7 / 12 - 500.5));
  });
  it("rejects preview recalculation for locked months", () => {
    for (const month of ["2026-08", "2026-09"])
      expect(() => calculate({ ...base, month })).toThrow(/locked/);
  });
  it("rejects duplicate attendance records", () => {
    const row = { lesson_id: "l6", student_id: "s1", status: "Present" };
    expect(() => calculate({ ...base, attendance: [row, row] })).toThrow(/Duplicate/);
  });
});
