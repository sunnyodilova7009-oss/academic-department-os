import React from 'react';
import { afterEach,expect,it,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GroupEditor,LessonEditor } from './admin-editors.jsx';
import { payrollPartsTotal } from './logic.js';
import { sb } from './client.js';
vi.mock('./client.js',()=>({sb:{from:vi.fn()}}));
afterEach(cleanup);
it('creates a group with the selected teacher in one save',async()=>{
  const saved=vi.fn(),insert=vi.fn(payload=>({select:()=>({single:async()=>({data:{id:'new',...payload}})})}));sb.from.mockReturnValue({insert});
  render(<GroupEditor teachers={[{id:'t',name:'Teacher One',active:true}]} onSaved={saved}/>);
  fireEvent.change(screen.getByLabelText('Group name'),{target:{value:'New Group'}});
  fireEvent.change(screen.getByLabelText('Teacher'),{target:{value:'t'}});
  fireEvent.change(screen.getByLabelText('Start date'),{target:{value:'2026-10-18'}});
  fireEvent.click(screen.getByRole('button',{name:'Save group'}));
  await waitFor(()=>expect(saved).toHaveBeenCalledOnce());
  expect(insert).toHaveBeenCalledWith({name:'New Group',teacher_id:'t',start_date:'2026-10-18',active:true});
});
it('suggests the next continuous number and saves a review lesson as LIVE-only pay',async()=>{
  const saved=vi.fn(),insert=vi.fn(payload=>({select:()=>({single:async()=>({data:{id:'new',...payload}})})}));sb.from.mockReturnValue({insert});
  render(<LessonEditor group={{id:'g',name:'Group',teacher_id:'t'}} lessons={[{id:'a',group_id:'g',lesson_date:'2026-08-31',lesson_number:17},{id:'b',group_id:'g',lesson_date:'2026-09-01',lesson_number:1}]} onSaved={saved}/>);
  expect(screen.getByLabelText('Lesson number').value).toBe('19');
  fireEvent.change(screen.getByLabelText('Lesson date'),{target:{value:'2026-10-18'}});
  fireEvent.change(screen.getByLabelText('Lesson type'),{target:{value:'review'}});
  fireEvent.click(screen.getByRole('button',{name:'Save lesson'}));
  await waitFor(()=>expect(saved).toHaveBeenCalledOnce());
  expect(insert).toHaveBeenCalledWith({group_id:'g',lesson_number:19,lesson_date:'2026-10-18',payroll_payable:true,is_review:true});
});
it('shows a permission error and leaves the form available',async()=>{
  sb.from.mockReturnValue({insert:()=>({select:()=>({single:async()=>({error:{message:'permission denied'}})})})});
  render(<GroupEditor teachers={[{id:'t',name:'Teacher One'}]} onSaved={vi.fn()}/>);
  fireEvent.change(screen.getByLabelText('Group name'),{target:{value:'New Group'}});
  fireEvent.change(screen.getByLabelText('Teacher'),{target:{value:'t'}});
  fireEvent.click(screen.getByRole('button',{name:'Save group'}));
  expect((await screen.findByRole('alert')).textContent).toBe('permission denied');
});
it('subtracts cover transfers exactly as the database generated total does',()=>{
  expect(payrollPartsTotal({fixed_amount:100000,attendance_amount:5000,cover_transfer:10000,adjustments:-500})).toBe(94500);
});

it.each(['finished','closed_early','active'])('saves group status %s while preserving history',async(status)=>{
 const saved=vi.fn(),update=vi.fn(payload=>({eq:()=>({select:()=>({single:async()=>({data:{id:'g',...payload}})})})}));sb.from.mockReturnValue({update});
 render(<GroupEditor group={{id:'g',name:'Group',teacher_id:'t',start_date:'2026-06-01',active:false,closure_status:'finished'}} teachers={[{id:'t',name:'Teacher'}]} onSaved={saved}/>);
 fireEvent.change(screen.getByLabelText('Group status'),{target:{value:status}});
 fireEvent.click(screen.getByRole('button',{name:'Save group'}));
 await waitFor(()=>expect(saved).toHaveBeenCalledOnce());
 expect(update).toHaveBeenCalledWith({name:'Group',teacher_id:'t',start_date:'2026-06-01',active:status==='active',closure_status:status==='active'?null:status});
 expect(sb.from).toHaveBeenLastCalledWith('groups');
});
