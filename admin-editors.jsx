import React, { useRef, useState } from 'react';
import { sb } from './client.js';
import { localDate, nextLessonNumber, courseLessons, validDate } from './logic.js';

export function GroupEditor({ group, teachers, onSaved, onCancel }) {
  const [name,setName]=useState(group?.name||''), [teacher,setTeacher]=useState(group?.teacher_id||''), [start,setStart]=useState(group?.start_date||localDate());
  const [busy,setBusy]=useState(false), [error,setError]=useState('');
  const pending=useRef(false);
  async function save(e){
    e.preventDefault(); if(pending.current)return;
    if(!name.trim()||!teacher||!validDate(start)){setError('Enter a name, teacher and valid start date.');return;}
    pending.current=true;setBusy(true);setError('');
    try{
      const payload={name:name.trim(),teacher_id:teacher,start_date:start};
      const request=group?sb.from('groups').update(payload).eq('id',group.id):sb.from('groups').insert({...payload,active:true});
      const {data,error}=await request.select().single();if(error)throw error;
      onSaved(data);
    }catch(e){setError(e.message);}finally{pending.current=false;setBusy(false);}
  }
  return <form className="formbar" onSubmit={save}><h3>{group?'Edit group':'Create group'}</h3>
    <label>Group name <input required value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>Teacher <select required value={teacher} onChange={e=>setTeacher(e.target.value)}><option value="">Choose teacher</option>{teachers.filter(t=>t.active!==false||t.id===teacher).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    <label>Start date <input required type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
    <button disabled={busy}>{busy?'Saving…':'Save group'}</button><button type="button" disabled={busy} onClick={onCancel}>Cancel</button>{error&&<p className="error" role="alert">{error}</p>}
  </form>;
}

export function LessonEditor({ group, lessons, onSaved, onCancel }) {
  const [number,setNumber]=useState(String(nextLessonNumber(lessons,group.id))),[date,setDate]=useState(localDate),[lessonType,setLessonType]=useState('regular');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''); const pending=useRef(false);
  async function save(e){
    e.preventDefault();if(pending.current)return;
    if(!validDate(date)||!Number.isInteger(Number(number))||Number(number)<1){setError('Enter a valid date and positive whole lesson number.');return;}
    if(courseLessons(lessons,group.id).some(l=>l.lesson_number===Number(number))){setError('This lesson number already exists.');return;}
    if(lessons.some(l=>l.group_id===group.id&&l.lesson_date===date)){setError('A lesson already exists on this date. Open it to record attendance.');return;}
    if(!group.teacher_id){setError('Assign this group a teacher before adding a payable lesson.');return;}
    pending.current=true;setBusy(true);setError('');
    try{
      const {data,error}=await sb.from('lessons').insert({group_id:group.id,lesson_number:Number(number),lesson_date:date,payroll_payable:lessonType!=='unpaid',is_review:lessonType==='review'}).select().single();if(error)throw error;
      onSaved(data);
    }catch(e){setError(e.message);}finally{pending.current=false;setBusy(false);}
  }
  return <form className="formbar" onSubmit={save}><h3>{group.name} — Add lesson</h3>
    <label>Lesson number <input required type="number" min="1" step="1" value={number} onChange={e=>setNumber(e.target.value)}/></label>
    <label>Lesson date <input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
    <label>Lesson type <select value={lessonType} onChange={e=>setLessonType(e.target.value)}><option value="regular">Regular lesson</option><option value="review">Review lesson (LIVE pay only)</option><option value="unpaid">Unpaid lesson</option></select></label>
    <button disabled={busy}>{busy?'Saving…':'Save lesson'}</button><button type="button" disabled={busy} onClick={onCancel}>Cancel</button>{error&&<p className="error" role="alert">{error}</p>}
  </form>;
}
