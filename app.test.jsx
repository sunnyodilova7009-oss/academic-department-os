import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  App,
  AcademicSheet,
  Dashboard,
  Finance,
  Payroll,
  readAppData,
} from "./components.jsx";
import { Students, Groups } from "./legacy.jsx";
import {
  dashboardCounts,
  nextLessonNumber,
  paymentPayload,
  payrollTotal,
  validDate,
} from "./logic.js";
import { readAll, sb, tables } from "./client.js";

vi.mock("./client.js", () => ({
  tables: { students: "students" },
  readAll: vi.fn(),
  sb: {
    auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(), signOut: vi.fn() },
    functions: { invoke: vi.fn() },
    from: vi.fn(),
  },
}));

const fixture = () => ({
  students: [
    {
      id: "s1",
      full_name: "Ali",
      phone: "+998 90 123-45-67",
      joined_at: "2026-08-01",
      status: "active",
    },
    {
      id: "s2",
      full_name: "Zara",
      phone: "55555",
      joined_at: "2026-09-05",
      left_at: "2026-09-20",
      status: "left",
    },
    {
      id: "s3",
      full_name: "Future",
      joined_at: "2026-10-01",
      status: "active",
    },
  ],
  groups: [
    { id: "g1", name: "Group A", starting_enrollment: 20 },
    { id: "g2", name: "Group B" },
  ],
  members: [
    { group_id: "g1", student_id: "s1", active: true },
    { group_id: "g1", student_id: "s1", active: false },
    { group_id: "g2", student_id: "s2" },
  ],
  lessons: [
    { id: "l1", group_id: "g1", lesson_number: 12, lesson_date: "2026-08-31" },
    { id: "l2", group_id: "g1", lesson_number: 13, lesson_date: "2026-09-01" },
    { id: "l3", group_id: "g1", lesson_number: 14, lesson_date: "2026-09-03" },
  ],
  attendance: [
    { lesson_id: "l1", student_id: "s1", status: "present" },
    { lesson_id: "l2", student_id: "s1", status: "absent" },
  ],
  homework: [
    { lesson_id: "l1", student_id: "s1", status: "done" },
    { lesson_id: "l2", student_id: "s1", status: "missing" },
  ],
  exams: [
    { id: "e1", group_id: "g1", name: "August exam", exam_date: "2026-08-30" },
    {
      id: "e2",
      group_id: "g1",
      name: "September exam",
      exam_date: "2026-09-30",
    },
  ],
  scores: [
    { exam_id: "e1", student_id: "s1", test_score: 90, speaking_score: 80 },
    { exam_id: "e2", student_id: "s1", test_score: 75, speaking_score: 60 },
  ],
  periods: [
    { id: "p1", period_month: "2026-08-01" },
    { id: "p2", period_month: "2026-09-01" },
  ],
  payroll: [
    {
      payroll_period_id: "p1",
      group_id: "g1",
      total_amount: 8432332,
      fixed_amount: 8000000,
      adjustments: 432332,
    },
    {
      payroll_period_id: "p2",
      group_id: "g1",
      total_amount: 11467345.68,
      fixed_amount: 6000000,
      adjustments: 5467345.68,
    },
  ],
  payments: [
    {
      id: "pay1",
      student_id: "s1",
      group_id: "g1",
      payment_date: "2026-08-10",
      amount: 100,
    },
    { id: "pay2", payment_date: "2026-09-10", amount: 200 },
    {
      id: "pay3",
      payment_date: "2026-09-10",
      amount: 999,
      counts_as_cash_payment: false,
    },
  ],
  metrics: [
    { group_id: "g1", course_month: 2, student_count: 18 },
    { group_id: "g1", course_month: 3, student_count: 15 },
  ],
  intakes: [],
  teachers: [],
  profiles: [{ id: "user", full_name: "Owner", role: "owner_admin", active: true }],
});
beforeEach(() => {
  sb.auth.getSession.mockResolvedValue({
    data: { session: { user: { id: "user" } } },
  });
  sb.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
  Object.assign(
    tables,
    Object.fromEntries(Object.keys(fixture()).map((key) => [key, key])),
  );
  readAll.mockImplementation(async (table) => fixture()[table]);
});
afterEach(cleanup);

describe("navigation and groups", () => {
  it("loads asynchronously and visits every page without changing hook order", async () => {
    render(<App Students={Students} Groups={Groups} />);
    await screen.findByText("Active Students");
    for (const name of [
      "Groups",
      "Students",
      "Support",
      "Payroll",
      "Finance",
      "Dashboard",
    ]) {
      fireEvent.click(screen.getByRole("button", { name, exact: true }));
      expect(screen.getByRole("heading", { name, level: 1 })).toBeTruthy();
    }
  });
  it("shows an explicit table permission error instead of zero counts", async () => {
    readAll.mockRejectedValueOnce(new Error("students: permission denied"));
    render(<App Students={Students} Groups={Groups} />);
    expect((await screen.findByRole("alert")).textContent).toContain(
      "permission denied",
    );
    expect(screen.queryByText("Active Students")).toBeNull();
  });
  it("hides payroll and finance for an academic-only admin", async () => {
    readAll.mockImplementation(async (table) => {
      const data = fixture();
      if (table === "profiles") return [{ id: "user", role: "academic_admin", active: true }];
      return data[table] || [];
    });
    render(<App Students={Students} Groups={Groups} />);
    await screen.findByText("Active Students");
    expect(screen.queryByRole("button", { name: "Payroll", exact: true })).toBeNull();
    expect(screen.queryByRole("button", { name: "Finance", exact: true })).toBeNull();
    expect(screen.queryByRole("button", { name: "Admin Access", exact: true })).toBeNull();
    expect(screen.queryByLabelText("Yearly income and salaries")).toBeNull();
    const requested = readAll.mock.calls.map(([table]) => table);
    expect(requested).not.toContain(tables.periods);
    expect(requested).not.toContain(tables.payroll);
    expect(requested).not.toContain(tables.payments);
  });
  it("retries transient future-issued JWT errors and reloads all tables", async () => {
    let failOnce = true;
    const read = vi.fn(async (table) => {
      if (table === "homework" && failOnce) {
        failOnce = false;
        throw new Error("homework: JWT issued at future");
      }
      return fixture()[table];
    });
    const pause = vi.fn().mockResolvedValue(undefined);
    const loaded = await readAppData(read, pause);
    expect(loaded.homework).toEqual(fixture().homework);
    expect(pause).toHaveBeenCalledOnce();
    expect(read).toHaveBeenCalledTimes(Object.keys(tables).length * 2);
  });
  it("keeps the requested columns and opens groups from their names", () => {
    render(<Groups d={fixture()} />);
    expect(
      screen.getAllByRole("columnheader").map((x) => x.textContent),
    ).toEqual([
      "Group",
      "Intake",
      "Start date",
      "M1",
      "M2",
      "Retention 1",
      "M3",
      "Retention 2",
    ]);
    fireEvent.click(
      screen.getByRole("button", { name: "Group A", exact: true }),
    );
    expect(screen.getByText("Group A — Academic Sheet")).toBeTruthy();
    expect(screen.getAllByText("Ali")).toHaveLength(2); // Lesson and assessment tables, no duplicate memberships.
    fireEvent.click(screen.getByRole("button", { name: "← Groups" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Group B", exact: true }),
    );
    expect(screen.getByText("Group B — Academic Sheet")).toBeTruthy();
    expect(screen.getByText("No lessons in this month.")).toBeTruthy();
  });
  it("searches by name and formatted phone and opens status options", async () => {
    render(<Students d={fixture()} />);
    const input = screen.getByRole("textbox", { name: "Search students" });
    fireEvent.change(input, { target: { value: "ali" } });
    expect(screen.getByText("Ali")).toBeTruthy();
    expect(screen.queryByText("Zara")).toBeNull();
    fireEvent.change(input, { target: { value: "901234567" } });
    expect(screen.getByText("Ali")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "active", exact: true }),
    );
    expect(screen.getByRole("option", { name: "Frozen" })).toBeTruthy();
  });
});

describe("dashboard charts", () => {
  it("shows teacher retention, adjustable group rankings, and yearly finance controls", () => {
    const d = fixture();
    d.groups[0].teacher_id = "t1";
    d.teachers = [{ id: "t1", name: "Amina" }];
    d.metrics = [
      { group_id: "g1", course_month: 2, student_count: 18, baseline_from_previous: 20, retained_from_previous: 18 },
      { group_id: "g1", course_month: 3, student_count: 15, baseline_from_previous: 18, retained_from_previous: 15 },
    ];
    d.periods.forEach((period) => { period.status = "approved"; });
    render(<Dashboard d={d} />);
    expect(screen.getByText("Top 5 Teachers by Retention")).toBeTruthy();
    expect(screen.getByText("Amina")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Group chart metric" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Retention checkpoint" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Finance chart year" }).value).toBe("2026");
    expect(screen.getByRole("img", { name: "2026 monthly income and approved salary chart" })).toBeTruthy();
  });
});

describe("academic records", () => {
  it("switches month, lesson, assessment and displays correct stored values", () => {
    const d = fixture();
    render(<AcademicSheet g={d.groups[0]} d={d} />);
    expect(screen.getByRole("combobox", { name: "Ali LIVE" }).value).toBe("");
    fireEvent.change(
      screen.getByRole("combobox", { name: "Lesson", exact: true }),
      { target: { value: "l2" } },
    );
    expect(screen.getByRole("combobox", { name: "Ali LIVE" }).value).toBe(
      "absent",
    );
    expect(screen.getByRole("combobox", { name: "Ali HW" }).value).toBe(
      "missing",
    );
    expect(screen.getByRole("spinbutton", { name: "Ali Test" }).value).toBe(
      "75",
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "Month", exact: true }),
      { target: { value: "2026-08" } },
    );
    expect(screen.getByRole("combobox", { name: "Ali LIVE" }).value).toBe(
      "present",
    );
    expect(screen.getByRole("combobox", { name: "Ali HW" }).value).toBe("done");
    expect(screen.getByRole("spinbutton", { name: "Ali Test" }).value).toBe(
      "90",
    );
  });
  it("persists a successful edit when moving between lessons", async () => {
    const d = fixture(),
      upsert = vi
        .fn()
        .mockReturnValue({
          select: () => ({
            single: async () => ({
              data: { lesson_id: "l3", student_id: "s1", status: "present" },
            }),
          }),
        });
    sb.from.mockReturnValue({ upsert });
    render(<AcademicSheet g={d.groups[0]} d={d} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Ali LIVE" }), {
      target: { value: "present" },
    });
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Ali LIVE" }).disabled).toBe(
        false,
      ),
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "Lesson", exact: true }),
      { target: { value: "l2" } },
    );
    expect(screen.getByRole("combobox", { name: "Ali LIVE" }).value).toBe(
      "absent",
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "Lesson", exact: true }),
      { target: { value: "l3" } },
    );
    expect(screen.getByRole("combobox", { name: "Ali LIVE" }).value).toBe(
      "present",
    );
    expect(upsert).toHaveBeenCalledWith(
      { lesson_id: "l3", student_id: "s1", status: "present" },
      { onConflict: "lesson_id,student_id" },
    );
  });
  it("shows denied writes and keeps the previous lesson value", async () => {
    sb.from.mockReturnValue({
      upsert: () => ({
        select: () => ({
          single: async () => ({ error: { message: "permission denied" } }),
        }),
      }),
    });
    const d = fixture();
    render(<AcademicSheet g={d.groups[0]} d={d} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Ali LIVE" }), {
      target: { value: "present" },
    });
    expect((await screen.findByRole("alert")).textContent).toBe(
      "permission denied",
    );
    expect(screen.getByRole("combobox", { name: "Ali LIVE" }).value).toBe("");
  });
  it("continues numbering across calendar months", () => {
    expect(nextLessonNumber(fixture().lessons, "g1")).toBe(15);
    expect(nextLessonNumber(fixture().lessons, "g2")).toBe(1);
  });
});

describe("monthly counts and finance", () => {
  it("counts month boundaries and excludes future students", () => {
    const d = fixture();
    expect(dashboardCounts(d, "2026-08")).toEqual({
      active: 1,
      left: 0,
      groups: 1,
      lessons: 1,
    });
    expect(dashboardCounts(d, "2026-09")).toEqual({
      active: 2,
      left: 1,
      groups: 1,
      lessons: 2,
    });
    render(<Dashboard d={d} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Month" }), {
      target: { value: "2026-08" },
    });
    expect(
      screen.getByText("Active Students").previousSibling.textContent,
    ).toBe("1");
  });
  it("filters both payment rows and totals by payment date", () => {
    render(<Finance d={fixture()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Payment month" }), {
      target: { value: "2026-08" },
    });
    expect(screen.getByText("Collected").previousSibling.textContent).toBe(
      "100",
    );
    expect(screen.getByText("Cash payments").previousSibling.textContent).toBe(
      "1",
    );
    expect(screen.queryByText("200")).toBeNull();
  });
  it("updates payment summary cards when group filters change", async () => {
    render(<Finance d={fixture()} />);
    await userEvent.setup().selectOptions(
      screen.getByRole("combobox", { name: "Filter payments by group" }),
      "g1",
    );
    expect(screen.getByText("Cash payments").previousSibling.textContent).toBe(
      "1",
    );
    expect(screen.getByText("Collected").previousSibling.textContent).toBe(
      "100",
    );
  });
  it("saves a real-shaped payment once and displays it in its month without reloading", async () => {
    const insert = vi.fn((payload) => ({
      select: () => ({
        single: async () => ({ data: { id: "new", ...payload } }),
      }),
    }));
    sb.from.mockReturnValue({ insert });
    const user = userEvent.setup();
    render(<Finance d={fixture()} />);
    await user.click(screen.getByRole("button", { name: "+ Add Payment" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Group", exact: true }),
      "g1",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Student", exact: true }),
      "s1",
    );
    fireEvent.change(screen.getByLabelText("Date", { exact: true }), {
      target: { value: "2026-09-15" },
    });
    await user.type(screen.getByRole("spinbutton", { name: "Amount" }), "300");
    await user.type(screen.getByRole("textbox", { name: "Note" }), "September");
    await user.click(screen.getByRole("button", { name: "Save Payment" }));
    expect(await screen.findByText("Payment saved.")).toBeTruthy();
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith({
      group_id: "g1",
      student_id: "s1",
      payment_date: "2026-09-15",
      amount: 300,
      course_month: 1,
      payment_note: "September",
      payment_kind: "monthly",
      counts_as_cash_payment: true,
    });
    expect(screen.getByText("Collected").previousSibling.textContent).toBe(
      "500",
    );
  });
  it("rejects invalid payment amounts, dates, months and unrelated students", () => {
    const input = {
      gid: "g1",
      sid: "s1",
      date: "2026-09-15",
      amount: "100",
      cm: "1",
      note: "",
    };
    for (const override of [
      { amount: "-1" },
      { amount: "0" },
      { amount: "Infinity" },
      { sid: "s2" },
      { cm: "13" },
      { date: "2026-02-30" },
    ])
      expect(() =>
        paymentPayload({ ...input, ...override }, fixture().members),
      ).toThrow();
    expect(validDate("2026-02-28")).toBe(true);
  });
  it("shows payroll details without the approved-total warning", () => {
    const d = fixture(),
      before = JSON.stringify(d.payroll);
    render(<Payroll d={d} />);
    expect(screen.queryByText(/differs from approved/)).toBeNull();
    expect(screen.getByText("Component sum: 11,467,345.68")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Period" }), {
      target: { value: "p1" },
    });
    expect(screen.queryByText(/differs from approved/)).toBeNull();
    expect(screen.getByText("Component sum: 8,432,332")).toBeTruthy();
    expect(JSON.stringify(d.payroll)).toBe(before);
    expect(
      payrollTotal(d.payroll.filter((x) => x.payroll_period_id === "p1")),
    ).toBe(8432332);
  });
});
