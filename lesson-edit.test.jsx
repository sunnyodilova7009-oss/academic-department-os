import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LessonEditor } from './admin-editors.jsx';
import { courseLessons, nextLessonNumber } from './logic.js';
import { sb } from './client.js';
vi.mock('./client.js',()=>({sb:{from:vi.fn()}}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const group={id:'g',name:'Elementary 10',teacher_id:'t'};
const raw={id:'lesson',group_id:'g',lesson_number:1,lesson_date:'2026-10-22',source_period:'2026-10',payroll_payable:true,is_review:true};
const lessons=[{id:'previous',group_id:'g',lesson_number:11,lesson_date:'2026-09-30'},raw];
const selected=()=>courseLessons(lessons,'g').find(l=>l.id===raw.id);
function setup(result){
 const saved=vi.fn(),cancel=vi.fn(),eq=vi.fn(()=>({select:()=>({single:async()=>result})})),update=vi.fn(()=>({eq}));
 sb.from.mockReturnValue({update});
 render(<LessonEditor group={group} lessons={lessons} lesson={selected()} onSaved={saved} onCancel={cancel}/>);
 return {saved,cancel,eq,update};
}
it('edits the same lesson without changing imported numbers, type, or linked records',async()=>{
 const changed={...raw,course_number:14,numbering_date:raw.lesson_date,lesson_date:'2026-10-23'};
 const {saved,eq,update}=setup({data:changed});
 expect(screen.getByLabelText('Lesson number').value).toBe('12');
 fireEvent.change(screen.getByLabelText('Lesson number'),{target:{value:'14'}});
 fireEvent.change(screen.getByLabelText('Lesson date'),{target:{value:'2026-10-23'}});
 fireEvent.click(screen.getByRole('button',{name:'Save lesson'}));
 await waitFor(()=>expect(saved).toHaveBeenCalledWith(changed));
 expect(eq).toHaveBeenCalledWith('id','lesson');
 expect(update).toHaveBeenCalledWith({course_number:14,numbering_date:'2026-10-22',lesson_date:'2026-10-23'});
 expect(sb.from).toHaveBeenCalledExactlyOnceWith('lessons');
});
it.each([['Lesson number','11','This lesson number already exists.'],['Lesson date','2026-09-30','A lesson already exists'],['Lesson date','2026-11-01','Keep imported lessons']])('rejects conflicting %s %s',async(label,value,message)=>{
 const {update}=setup({});
 fireEvent.change(screen.getByLabelText(label),{target:{value}});
 fireEvent.click(screen.getByRole('button',{name:'Save lesson'}));
 expect((await screen.findByRole('alert')).textContent).toContain(message);
 expect(update).not.toHaveBeenCalled();
});
it('cancel does not write',()=>{
 const {update,cancel}=setup({});
 fireEvent.change(screen.getByLabelText('Lesson number'),{target:{value:'15'}});
 fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
 expect(cancel).toHaveBeenCalledOnce();expect(update).not.toHaveBeenCalled();
});
it('keeps permission errors visible without reporting success',async()=>{
 const {saved}=setup({error:{message:'Permission denied'}});
 fireEvent.click(screen.getByRole('button',{name:'Save lesson'}));
 expect((await screen.findByRole('alert')).textContent).toBe('Permission denied');
 expect(saved).not.toHaveBeenCalled();
});
it('preserves sibling numbers when an edited lesson changes chronological position',()=>{
 const rows=[...lessons,{id:'next',group_id:'g',lesson_number:2,lesson_date:'2026-10-24'}];
 const updated=rows.map(l=>l.id===raw.id?{...l,course_number:10,numbering_date:l.lesson_date,lesson_date:'2026-10-28'}:l);
 expect(courseLessons(updated,'g').map(l=>[l.id,l.lesson_number])).toEqual([['previous',11],['next',13],['lesson',10]]);
 expect(nextLessonNumber(updated,'g')).toBe(14);
});
