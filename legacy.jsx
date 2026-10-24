import React, { useState, useRef } from "react";

import { sb } from "./client.js";
import { AcademicSheet, Table } from "./components.jsx";
import { localDate, nextLessonNumber, validDate, courseLessons, retentionLabel, displayGroupName } from "./logic.js";
import { GroupEditor, LessonEditor } from './admin-editors.jsx';

export function Students({ d, refresh, onRecordSaved }) {
  const [saving,setSaving]=useState(false);const pendingSave=useRef(false);
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
    if(pendingSave.current)return;
    if (!name || !gid || !joined)
      return alert("Complete Name, Group and Joined Date.");
    pendingSave.current=true;setSaving(true);
    try{
      const r=await sb.rpc('admin_create_student',{p_name:name,p_phone:phone||null,p_group_id:gid,p_joined_at:joined});
      if(r.error)throw r.error;
      const studentId=typeof r.data==='string'?r.data:r.data?.id;
      if(studentId){
        const [student,membership]=await Promise.all([
          sb.from('students').select('*').eq('id',studentId).single(),
          sb.from('group_students').select('*').eq('student_id',studentId).eq('group_id',gid).single(),
        ]);
        if(student.error)throw student.error;
        if(membership.error)throw membership.error;
        onRecordSaved?.('students',student.data);
        onRecordSaved?.('members',membership.data);
      }else refresh?.();
      setName("");setPhone("");setJoined("");
    }catch(e){alert(e.message);}finally{pendingSave.current=false;setSaving(false);}
  }
  async function saveStatus() {
    let s = editing;
    if (!s) return;
    if (st === "active") {
      if (!newGroup) return alert("Choose a group for the active student.");
      let r = await sb.rpc("admin_change_student_status", {
        p_student_id: s.id,
        p_group_id: newGroup,
        p_status:'active',p_reason:null,
      });
      if (r.error) return alert(r.error.message);
    } else {
      if (
        ["frozen", "stopped", "left", "transferred"].includes(st) &&
        !reason.trim()
      )
        return alert("Enter a reason.");
      let r = await sb.rpc("admin_change_student_status", {
        p_student_id: s.id,
        p_status: st,
        p_reason: reason,
      });
      if (r.error) return alert(r.error.message);
    }
    refresh?.();
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
          aria-label="Student name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          placeholder="Phone"
          aria-label="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <select aria-label="Student group" value={gid} onChange={(e) => setGid(e.target.value)}>
          <option value="">Choose group</option>
          {d.groups.filter(g=>g.active!==false).map((g) => (
            <option value={g.id}>{displayGroupName(g.name)}</option>
          ))}
        </select>
        <input
          type="date"
          aria-label="Joined date"
          value={joined}
          onChange={(e) => setJoined(e.target.value)}
        />
        <button disabled={saving} onClick={add}>{saving?'Saving…':'+ Add Student'}</button>
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
                <option value={g.id}>{displayGroupName(g.name)}</option>
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
              g ? displayGroupName(g.name) : "—",
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
  const [groupEditor,setGroupEditor]=useState(null),[lessonGroup,setLessonGroup]=useState(null);
  const [scope,setScope]=useState("active");
  async function lesson(g) {
    setLessonGroup(g);
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
  const lessonForm=lessonGroup?<LessonEditor key={lessonGroup.id} group={lessonGroup} lessons={d.lessons} onCancel={()=>setLessonGroup(null)} onSaved={row=>{onRecordSaved?.('lessons',row);setLessonGroup(null);}}/>:null;
  if (open)
    return (
      <div className="group-academic-view"><div>{lessonForm}</div>
      <AcademicSheet
        key={open}
        g={d.groups.find((x) => x.id === open)}
        d={d}
        back={() => setOpen(null)}
        addLesson={lesson}
        onRecordSaved={onRecordSaved}
      /></div>
    );
  async function createGroup() {
    setGroupEditor({});
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
        <label>Show <select aria-label="Group status filter" value={scope} onChange={e=>setScope(e.target.value)}><option value="active">Active groups</option><option value="finished">Finished groups</option><option value="closed_early">Closed early groups</option><option value="closed">All inactive groups</option><option value="all">All groups</option></select></label>
      </div>
      {groupEditor&&<GroupEditor key={groupEditor.id||'new'} group={groupEditor.id?groupEditor:null} teachers={d.teachers||[]} onCancel={()=>setGroupEditor(null)} onSaved={row=>{onRecordSaved?.('groups',row);setGroupEditor(null);}}/>}
      {lessonForm}
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
        ]}
        rows={d.groups.filter(g=>scope==="all"||(scope==="active"?g.active!==false:g.active===false&&(scope==="closed"||g.closure_status===scope))).map((g) => {
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
          const retention=n=>retentionLabel(d.metrics?.find(x=>x.group_id===g.id&&Number(x.course_month)===n),n===2?a:b);
          r12=retention(2);r23=retention(3);
          return [
            <span className="group-name-cell"><button className="group-open" onClick={() => setOpen(g.id)}>{displayGroupName(g.name)}</button><button className="icon-button" aria-label={`Edit ${displayGroupName(g.name)}`} title="Edit group" onClick={()=>setGroupEditor(g)}>✎</button>{g.active===false&&<small className="closed-label">{g.closure_status==='finished'?'Finished':g.closure_status==='closed_early'?'Closed early':'Closed'}</small>}</span>,
            <button className="editcell" onClick={() => intake(g)}>
              {d.intakes.find((x) => x.id === g.intake_id)?.name ||
                "+ Set intake"}
            </button>,
            g.start_date,
            a,
            b ?? "—",
            <span className={r12!=="—"&&Number.parseInt(r12,10)<50?"retention-pill low-retention":"retention-pill"}>{r12}</span>,
            cc ?? "—",
            <span className={r23!=="—"&&Number.parseInt(r23,10)<50?"retention-pill low-retention":"retention-pill"}>{r23}</span>,
          ];
        })}
      />
    </>
  );
}
