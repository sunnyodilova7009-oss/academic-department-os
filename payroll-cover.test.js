import { expect, it } from "vitest";
import { calculateCoverTransfers } from "./payroll-cover.js";

const base = {
  month: "2026-10", groupId: "g", ownerTeacherId: "owner",
  lessons: [{ id: "l", group_id: "g", lesson_date: "2026-10-10", payroll_payable: true }],
  enrollments: [{ group_id: "g", student_id: "s", joined_at: "2026-10-01" }],
  attendance: [{ lesson_id: "l", student_id: "s", status: "present" }],
  homework: [{ lesson_id: "l", student_id: "s", status: "done" }],
  covers: [{ lesson_id: "l", substitute_teacher_id: "sub" }],
};
it("transfers fixed attendance and homework exactly once", () => {
  const result = calculateCoverTransfers(base);
  const expected = 50000 / 12 + 5000 + 3500;
  expect(result.owner).toBeCloseTo(-expected);
  expect(result.sub).toBeCloseTo(expected);
  expect(result.owner + result.sub).toBeCloseTo(0);
});
it("rejects duplicate covered lessons", () => {
  expect(() => calculateCoverTransfers({ ...base, covers: [...base.covers, ...base.covers] })).toThrow(/Duplicate/);
});
it("rejects review lessons and outside-month covers", () => {
  expect(() => calculateCoverTransfers({ ...base, lessons: [{ ...base.lessons[0], payroll_payable: false }] })).toThrow(/Non-payable/);
  expect(() => calculateCoverTransfers({ ...base, month: "2026-11" })).toThrow(/outside payroll month/);
});
it("does not pay students who joined after the covered lesson", () => {
  const result = calculateCoverTransfers({ ...base, enrollments: [{ ...base.enrollments[0], joined_at: "2026-10-11" }] });
  expect(result.owner).toBe(0);
  expect(result.sub).toBe(0);
});
