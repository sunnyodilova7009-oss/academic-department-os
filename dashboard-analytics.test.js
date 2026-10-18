import { describe, expect, it } from "vitest";
import {
  groupPerformance,
  topGroupsByPerformance,
  topTeachersByRetention,
  yearlyFinanceSeries,
} from "./logic.js";

describe("dashboard analytics", () => {
  const data = {
    groups: [
      { id: "g1", name: "Beginner 1", teacher_id: "t1" },
      { id: "g2", name: "Intermediate 2", teacher_id: "t2" },
    ],
    teachers: [{ id: "t1", name: "Amina" }, { id: "t2", name: "Bek" }],
    lessons: [
      { id: "l1", group_id: "g1", lesson_date: "2026-09-01" },
      { id: "l2", group_id: "g1", lesson_date: "2026-09-03" },
      { id: "l3", group_id: "g2", lesson_date: "2026-09-02" },
      { id: "l4", group_id: "g1", lesson_date: "2026-10-01" },
    ],
    attendance: [
      { lesson_id: "l1", status: "present" },
      { lesson_id: "l2", status: "absent" },
      { lesson_id: "l3", status: "present" },
    ],
    homework: [
      { lesson_id: "l1", status: "done" },
      { lesson_id: "l2", status: "partial" },
      { lesson_id: "l3", status: "missing" },
    ],
    exams: [
      { id: "e1", group_id: "g1", exam_date: "2026-09-10", max_score: 100 },
      { id: "e2", group_id: "g2", exam_date: "2026-09-11", max_score: 100 },
    ],
    scores: [
      { exam_id: "e1", test_score: 80, speaking_score: 100 },
      { exam_id: "e2", test_score: 50, speaking_score: null },
    ],
    metrics: [
      { group_id: "g1", course_month: 2, baseline_from_previous: 10, retained_from_previous: 8 },
      { group_id: "g1", course_month: 3, baseline_from_previous: 8, retained_from_previous: 6 },
      { group_id: "g2", course_month: 2, baseline_from_previous: 20, retained_from_previous: 18 },
    ],
    payments: [
      { payment_date: "2026-09-12", amount: 300, counts_as_cash_payment: true },
      { payment_date: null, amount: 900, counts_as_cash_payment: true },
      { payment_date: "2026-09-12", amount: 100, counts_as_cash_payment: false },
    ],
    periods: [
      { id: "approved", period_month: "2026-09-01", status: "approved" },
      { id: "open", period_month: "2026-10-01", status: "open" },
    ],
    payroll: [
      { payroll_period_id: "approved", total_amount: 250 },
      { payroll_period_id: "open", total_amount: 500 },
    ],
  };

  it("calculates the selected month and treats partial homework as submitted", () => {
    const [beginner] = groupPerformance(data, "2026-09").filter((row) => row.groupId === "g1");
    expect(beginner.attendance).toBe(50);
    expect(beginner.homework).toBe(100);
    expect(beginner.assessment).toBe(90);
    expect(beginner.combined).toBe(80);
    expect(topGroupsByPerformance(data, "2026-09", "assessment")[0].name).toBe("Beginner 1");
    expect(groupPerformance(data, "2026-10")).toEqual([]);
  });

  it("ranks teacher retention weighted by students, by course checkpoint", () => {
    expect(topTeachersByRetention(data, 2)[0]).toMatchObject({ name: "Bek", retained: 18, baseline: 20, retention: 90 });
    expect(topTeachersByRetention(data, 3)[0]).toMatchObject({ name: "Amina", retained: 6, baseline: 8, retention: 75 });
  });

  it("charts only dated cash and approved payroll", () => {
    const series = yearlyFinanceSeries(data, 2026);
    expect(series.income["2026-09"]).toBe(300);
    expect(series.datedIncomeRows).toBe(1);
    expect(series.salary["2026-09"]).toBe(250);
    expect(series.salary["2026-10"]).toBe(0);
  });
});

