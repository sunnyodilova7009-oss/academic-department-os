import React, { useState } from "react";

import { sb } from "./client.js";
import { AcademicSheet, Table } from "./components.jsx";
import { localDate, nextLessonNumber, validDate, courseLessons } from "./logic.js";

export function Students({ d }) {
  const [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [gid, setGid] = useState(""),
    [joined, setJoined] = useState(""),
    [search, setSearch] = useState(""),
    [editing, setEditing] = useState(null),
    [st, setSt] = useState("active"),
    [reason, setReason] = useState(""),
    [newGroup, setNewGroup] = useState("");
  async function add() {
    if (!name || !gid || !joined)
      return alert("Complete Name, Group and Joined Date.");
    let r = await sb
      .from("students")
      .insert({
        full_name: name,
        phone: phone || null,
        joined_at: joined,
        status: "active",
      })
      .select()
      .single();
    if (r.error) return alert(r.error.message);
    let m = await sb.from("group_students").insert({
      student_id: r.data.id,
      group_id: gid,
      joined_at: joined,
      active: true,
    });
    if (m.error) return alert(m.error.message);
    location.reload();
  }
  async function saveStatus() {
    let s = editing;
    if (!s) return;
    if (st === "active") {
      if (!newGroup) return alert("Choose a group for the active student.");
      let r = await sb.rpc("activate_student_in_group", {
        p_student_id: s.id,
        p_group_id: newGroup,
        p_joined_at: new Date().toISOString().slice(0, 10),
      });
      if (r.error) return alert(r.error.message);
    } else {
      if (
        ["frozen", "stopped", "left", "transferred"].includes(st) &&
        !reason.trim()
      )
        return alert("Enter a reason.");
      let r = await sb.rpc("change_student_status", {
        p_student_id: s.id,
        p_status: st,
        p_reason: reason,
      });
      if (r.error) return alert(r.error.message);
    }
    location.reload();
  }
  return (
    <>
      <div className="formbar">
        <label>
          Search students{" "}
          <input
            placeholder="Name or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <div className="formbar">
        <input
          placeholder="Student name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <select value={gid} onChange={(e) => setGid(e.target.value)}>
          <option value="">Choose group</option>
          {d.groups.map((g) => (
            <option value={g.id}>{g.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={joined}
          onChange={(e) => setJoined(e.target.value)}
        />
        <button onClick={add}>+ Add Student</button>
      </div>
      {editing && (
        <div className="panel editor">
          <h3>{editing.full_name} — Change Status</h3>
          <select value={st} onChange={(e) => setSt(e.target.value)}>
            <option value="active">Active</option>
            <option value="frozen">Frozen</option>
            <option value="stopped">Stopped</option>
            <option value="left">Left</option>
            <option value="transferred">Transferred</option>
          </select>
          {st === "active" && (
            <select
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
            >
              <option value="">Choose group</option>
              {d.groups.map((g) => (
                <option value={g.id}>{g.name}</option>
              ))}
            </select>
          )}
          {st !== "active" && (
            <input
              placeholder="Reason / comment"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
          <button onClick={saveStatus}>Save Status</button>
          <button onClick={() => setEditing(null)}>Cancel</button>
        </div>
      )}
      <Table
        heads={[
          "Name",
          "Group",
          "Phone",
          "Status",
          "Joined",
          "Left / Status Date",
          "Reason",
        ]}
        rows={d.students
          .filter(
            (s) =>
              !search ||
              (s.full_name || "")
                .toLowerCase()
                .includes(search.toLowerCase()) ||
              ((s.phone || "")
                .replace(/\D/g, "")
                .includes(search.replace(/\D/g, "")) &&
                /\d/.test(search)),
          )
          .map((s) => {
            let m = d.members.find((x) => x.student_id === s.id && x.active),
              g = d.groups.find((x) => x.id === m?.group_id);
            return [
              s.full_name,
              g?.name || "—",
              s.phone,
              <button
                onClick={() => {
                  setEditing(s);
                  setSt(s.status === "paused" ? "frozen" : s.status);
                  setNewGroup(g?.id || "");
                  setReason(s.status_comment || "");
                }}
              >
                {s.status}
              </button>,
              s.joined_at,
              s.left_at || s.status_changed_at,
              s.status_comment,
            ];
          })}
      />
    </>
  );
}
export function Groups({ d, onRecordSaved }) {
  const [open, setOpen] = useState(null);
  async function lesson(g) {
    const next = nextLessonNumber(d.lessons, g.id);
    const number = prompt("Lesson number", String(next));
    if (number === null) return;
    if (!Number.isInteger(Number(number)) || Number(number) < 1)
      return alert("Enter a positive whole lesson number.");
    if (
      courseLessons(d.lessons,g.id).some(
        (x) =>
          x.group_id === g.id && Number(x.lesson_number) === Number(number),
      )
    )
      return alert("This lesson number already exists in this group.");
    const date = prompt("Lesson date (YYYY-MM-DD)", localDate());
    if (date === null) return;
    if (!validDate(date)) return alert("Enter a valid date as YYYY-MM-DD.");
    const payable = confirm(
      "OK = Payable lesson. Cancel = Review / non-payable.",
    );
    try {
      const result = await sb
        .from("lessons")
        .insert({
          group_id: g.id,
          lesson_number: Number(number),
          lesson_date: date,
          payroll_payable: payable,
        })
        .select()
        .single();
      if (result.error) throw result.error;
      location.reload();
    } catch (e) {
      alert(e.message);
    }
  }
  async function metric(g, n, current) {
    let v = prompt("Student count for course month " + n, current ?? "");
    if (v === null || v === "") return;
    let r = await sb
      .from("group_month_metrics")
      .upsert(
        { group_id: g.id, course_month: n, student_count: Number(v) },
        { onConflict: "group_id,course_month" },
      );
    if (r.error) alert(r.error.message);
    else location.reload();
  }
  async function intake(g) {
    let name = prompt(
      "Intake name",
      d.intakes.find((x) => x.id === g.intake_id)?.name || "",
    );
    if (!name) return;
    let found = d.intakes.find(
        (x) => x.name.toLowerCase() === name.toLowerCase(),
      ),
      id = found?.id;
    if (!id) {
      let r = await sb.from("intakes").insert({ name }).select().single();
      if (r.error) return alert(r.error.message);
      id = r.data.id;
    }
    let r = await sb.from("groups").update({ intake_id: id }).eq("id", g.id);
    if (r.error) alert(r.error.message);
    else location.reload();
  }
  if (open)
    return (
      <AcademicSheet
        key={open}
        g={d.groups.find((x) => x.id === open)}
        d={d}
        back={() => setOpen(null)}
        addLesson={lesson}
        onRecordSaved={onRecordSaved}
      />
    );
  async function createGroup() {
    let name = prompt("Group name");
    if (!name) return;
    let start = prompt(
      "Start date YYYY-MM-DD",
      new Date().toISOString().slice(0, 10),
    );
    if (!start) return;
    let r = await sb
      .from("groups")
      .insert({ name, start_date: start, active: true })
      .select()
      .single();
    if (r.error) alert(r.error.message);
    else location.reload();
  }
  async function createIntake() {
    let name = prompt("New intake name");
    if (!name) return;
    let r = await sb.from("intakes").insert({ name });
    if (r.error) alert(r.error.message);
    else location.reload();
  }
  return (
    <>
      <div className="formbar">
        <b>Groups & Intakes</b>
        <button onClick={createGroup}>+ Create Group</button>
        <button onClick={createIntake}>+ Create Intake</button>
        <span>{d.intakes?.length || 0} intakes</span>
      </div>
      <Table
        heads={[
          "Group",
          "Intake",
          "Start date",
          "M1",
          "M2",
          "Retention 1",
          "M3",
          "Retention 2",
          "Actions",
        ]}
        rows={d.groups.map((g) => {
          let m = (n) =>
            d.metrics?.find(
              (x) => x.group_id === g.id && Number(x.course_month) === n,
            )?.student_count;
          let fallback = (n) => {
            let hist = d.members.filter((x) => x.group_id === g.id);
            return n === 1
              ? (g.starting_enrollment ??
                  new Set(hist.map((x) => x.student_id)).size)
              : "—";
          };
          let a = m(1) ?? fallback(1),
            b = m(2),
            cc = m(3),
            r12 =
              Number(a) && b != null
                ? Math.round((b / Number(a)) * 100) + "%"
                : "—",
            r23 =
              Number(b) && cc != null
                ? Math.round((cc / Number(b)) * 100) + "%"
                : "—";
          return [
            g.name,
            <button className="editcell" onClick={() => intake(g)}>
              {d.intakes.find((x) => x.id === g.intake_id)?.name ||
                "+ Set intake"}
            </button>,
            g.start_date,
            a,
            b ?? "—",
            r12,
            cc ?? "—",
            r23,
            <span>
              <button onClick={() => setOpen(g.id)}>Open</button>{" "}
              <button onClick={() => lesson(g)}>+ Add Lesson</button>
            </span>,
          ];
        })}
      />
    </>
  );
}
