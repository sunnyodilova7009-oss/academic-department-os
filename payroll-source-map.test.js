import { expect, it } from "vitest";
import { calculateFromAcademicRows } from "./payroll-source-map.js";

it("maps existing payroll_payable and joined_at fields", () => {
  const result = calculateFromAcademicRows({
    month: "2026-10", groupId: "g", teacherId: "t",
    lessons: [
      { id: "l1", group_id: "g", lesson_date: "2026-10-01", payroll_payable: true },
      { id: "l2", group_id: "g", lesson_date: "2026-10-02", payroll_payable: false },
    ],
    members: [{ group_id: "g", student_id: "s", joined_at: "2026-10-01" }],
    attendance: [{ lesson_id: "l1", student_id: "s", status: "present" }],
    homework: [{ lesson_id: "l1", student_id: "s", status: "done" }],
  });
  expect(result.fixed_amount).toBeCloseTo(50000 / 12);
  expect(result.attendance_amount).toBe(5000);
  expect(result.homework_amount).toBe(3500);
  expect(result.preview_only).toBe(true);
});
