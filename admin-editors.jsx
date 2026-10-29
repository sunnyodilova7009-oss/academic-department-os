import React, { useRef, useState } from 'react';
import { sb } from './client.js';
import { localDate, nextLessonNumber, courseLessons, validDate } from './logic.js';

export function TeacherEditor({ teachers=[], onSaved, onCancel }) {
  const [name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const pending=useRef(false);
  async function save(e) {
    e.preventDefault();if(pending.current)return;
    const cleanName=name.trim().replace(/\s+/g,' ');
    if(!cleanName){setError('Enter the teacher’s name.');return;}
    if(teachers.some(t=>t.name.trim().replace(/\s+/g,' ').toLowerCase()===cleanName.toLowerCase())){
      setError('A teacher with this name already exists.');return;
    }
    pending.current=true;setBusy(true);setError('');
    try {
      const {data,error}=await sb.from('teachers').insert({name:cleanName,active:true}).select().single();
      if(error)throw error;
      onSaved(data);
    } catch(e) {setError(e.message);}
    finally {pending.current=false;setBusy(false);}
  }
  return <form className="formbar" onSubmit={save}>
    <h3>Add teacher</h3>
    <label>Teacher name <input required maxLength="150" value={name} onChange={e=>setName(e.target.value)}/></label>
    <button disabled={busy}>{busy?'Saving…':'Save teacher'}</button>
    <button type="button" disabled={busy} onClick={onCancel}>Cancel</button>
    {error&&<p className="error" role="alert">{error}</p>}
  </form>;
}

export function GroupEditor({ group, teachers, onSaved, onCancel }) {
  const [name,setName]=useState(group?.name||''), [teacher,setTeacher]=useState(group?.teacher_id||''), [start,setStart]=useState(group?.start_date||localDate());
  const [status,setStatus]=useState(group?.active===false?(group.closure_status||'closed'):'active');
  const [busy,setBusy]=useState(false), [error,setError]=useState('');
  const pending=useRef(false);
  async function save(e){
    e.preventDefault(); if(pending.current)return;
    if(!name.trim()||!teacher||!validDate(start)){setError('Enter a name, teacher and valid start date.');return;}
    pending.current=true;setBusy(true);setError('');
    try{
      const payload={name:name.trim(),teacher_id:teacher,start_date:start,active:status==='active',...(group?{closure_status:['finished','closed_early'].includes(status)?status:null}:{})};
      const request=group?sb.from('groups').update(payload).eq('id',group.id):sb.from('groups').insert({...payload,active:true});
      const {data,error}=await request.select().single();if(error)throw error;
      onSaved(data);
    }catch(e){setError(e.message);}finally{pending.current=false;setBusy(false);}
  }
  return <form className="formbar" onSubmit={save}><h3>{group?'Edit group':'Create group'}</h3>
    <label>Group name <input required value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>Teacher <select required value={teacher} onChange={e=>setTeacher(e.target.value)}><option value="">Choose teacher</option>{teachers.filter(t=>t.active!==false||t.id===teacher).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    <label>Start date <input required type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
    {group&&<label>Group status <select value={status} onChange={e=>setStatus(e.target.value)}><option value="active">Active</option><option value="finished">Finished</option><option value="closed_early">Closed early</option>{group.active===false&&!group.closure_status&&<option value="closed">Closed (reason not set)</option>}</select></label>}
    {group&&status!=='active'&&<p className="hint">This group will leave the Active list. Its students, lessons and salary history will be kept. Choose Active to reopen it.</p>}
    <button disabled={busy}>{busy?'Saving…':'Save group'}</button><button type="button" disabled={busy} onClick={onCancel}>Cancel</button>{error&&<p className="error" role="alert">{error}</p>}
  </form>;
}

export function LessonEditor({ group, lessons, lesson, onSaved, onCancel }) {
  const [number,setNumber]=useState(String(lesson?.lesson_number ?? nextLessonNumber(lessons,group.id))),[date,setDate]=useState(lesson?.lesson_date || localDate()),[lessonType,setLessonType]=useState('regular');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''); const pending=useRef(false);
  async function save(e){
    e.preventDefault();if(pending.current)return;
    if(!validDate(date)||!Number.isInteger(Number(number))||Number(number)<1){setError('Enter a valid date and positive whole lesson number.');return;}
    if(courseLessons(lessons,group.id).some(l=>l.id!==lesson?.id&&l.lesson_number===Number(number))){setError('This lesson number already exists.');return;}
    if(lessons.some(l=>l.id!==lesson?.id&&l.group_id===group.id&&l.lesson_date===date)){setError('A lesson already exists on this date. Open it to record attendance.');return;}
    if(lesson?.source_period && date!==lesson.lesson_date && date.slice(0,7)!==lesson.source_period){setError('Keep imported lessons in their source month so their payroll remains correct.');return;}
    if(!lesson&&!group.teacher_id){setError('Assign this group a teacher before adding a payable lesson.');return;}
    pending.current=true;setBusy(true);setError('');
    try{
      const request=lesson
        ? sb.from('lessons').update({course_number:Number(number),lesson_date:date,numbering_date:lesson.numbering_date||lesson.lesson_date}).eq('id',lesson.id)
        : sb.from('lessons').insert({group_id:group.id,lesson_number:Number(number),lesson_date:date,payroll_payable:lessonType!=='unpaid',is_review:lessonType==='review'});
      const {data,error}=await request.select().single();if(error)throw error;
      onSaved(data);
    }catch(e){setError(e.message);}finally{pending.current=false;setBusy(false);}
  }
  return <form className="formbar" onSubmit={save}><h3>{group.name} — {lesson?'Edit lesson':'Add lesson'}</h3>
    <label>Lesson number <input required type="number" min="1" step="1" value={number} onChange={e=>setNumber(e.target.value)}/></label>
    <label>Lesson date <input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
    {!lesson&&<label>Lesson type <select value={lessonType} onChange={e=>setLessonType(e.target.value)}><option value="regular">Regular lesson</option><option value="review">Review lesson (LIVE pay only)</option></select></label>}
    {lesson&&<p className="hint">Attendance and homework stay with this lesson. Date changes can affect open payroll months. Approved salaries stay unchanged.{lesson.source_period?' Imported lessons must stay in their source month.':''}</p>}
    <button disabled={busy}>{busy?'Saving…':'Save lesson'}</button><button type="button" disabled={busy} onClick={onCancel}>Cancel</button>{error&&<p className="error" role="alert">{error}</p>}
  </form>;
}
