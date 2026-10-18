import { createClient } from "@supabase/supabase-js";

// This publishable key is intended for browser use. Database policies enforce access.
export const sb = createClient(
  "https://utuigrbcxiihwobamcxx.supabase.co",
  "sb_publishable_COC51VKRIxuzt4vf-zmZEA_YsT6t4NI",
);

export const tables = {
  students: "students",
  groups: "groups",
  lessons: "lessons",
  members: "group_students",
  metrics: "group_month_metrics",
  periods: "payroll_periods",
  payroll: "group_payroll",
  payments: "student_payments",
  intakes: "intakes",
  attendance: "attendance",
  homework: "homework",
  exams: "exams",
  scores: "exam_scores",
  teachers: "teachers",
  rosters: "group_student_months",
  rosterHistory: "student_roster_history",
  profiles: "profiles",
};

export async function inviteAcademicAdmin({ email, fullName }) {
  const { data, error } = await sb.functions.invoke("invite-academic-admin", {
    body: { email, fullName },
  });
  if (error) throw new Error(error.message || "Could not send the invitation.");
  return data.profile;
}

export async function readAll(table) {
  const rows = [];
  // Supabase limits individual responses. Never silently truncate monthly totals.
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb
      .from(table)
      .select("*")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}
