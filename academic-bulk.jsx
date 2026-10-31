import React, {useRef,useState} from 'react';
import {sb} from './client.js';

export function BulkMarks({lesson,groupName,students,records,type,onSaved,onCancel}) {
  const attendance=type==='attendance';
  const options=attendance?['present','absent']:['done','partial','missing'];
  const [values,setValues]=useState(()=>Object.fromEntries(students.map(s=>[s.id,options[0]])));
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const pending=useRef(false);
  const original=id=>records.find(r=>r.student_id===id)?.status||'';
  const changed=students.filter(s=>values[s.id]!==original(s.id));
  async function save(e) {
    e.preventDefault();if(pending.current||!changed.length)return;
    pending.current=true;setBusy(true);setError('');
    try {
      const {data,error}=await sb.from(type).upsert(changed.map(s=>({
        lesson_id:lesson.id,student_id:s.id,status:values[s.id]
      })),{onConflict:'lesson_id,student_id'}).select();
      if(error)throw error;
      onSaved(data);
    } catch(e) {
      setError('Could not save. Your choices are still here. Check your connection or permissions, then try again.');
    } finally {pending.current=false;setBusy(false);}
  }
  const label=value=>value?value[0].toUpperCase()+value.slice(1):'Not recorded';
  return <form className="panel bulk-review" onSubmit={save}>
    <h3>Review {attendance?'attendance':'homework'}</h3>
    <p>{groupName} · L{lesson.lesson_number} · {lesson.lesson_date}</p>
    <p>Everyone is marked {attendance?'Present':'Done'} below. Change any exceptions before saving.</p>
    <p className="hint">{changed.length} of {students.length} students will change. Nothing is saved until you press Save changes.</p>
    <div className="bulk-students">{students.map(s=><label className="bulk-student" key={s.id}>
      <span><strong>{s.full_name}</strong><small>Currently: {label(original(s.id))}</small></span>
      <select aria-label={s.full_name+' '+(attendance?'attendance':'homework')} disabled={busy} value={values[s.id]} onChange={e=>setValues(old=>({...old,[s.id]:e.target.value}))}>
        {options.map(value=><option key={value} value={value}>{label(value)}</option>)}
      </select>
    </label>)}</div>
    {error&&<p className="error" role="alert">{error}</p>}
    <div className="bulk-actions">
      <button type="submit" disabled={busy||!changed.length}>{busy?'Saving…':error?'Retry save':'Save changes'}</button>
      <button type="button" disabled={busy} onClick={onCancel}>Cancel</button>
      {busy&&<span role="status">Saving changes…</span>}
    </div>
  </form>;
}
