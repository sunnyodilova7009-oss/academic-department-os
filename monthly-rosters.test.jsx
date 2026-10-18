import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {dashboardCounts} from './logic.js';
import {AcademicSheet} from './components.jsx';
import {Students,Groups} from './legacy.jsx';
import {sb} from './client.js';
vi.mock('./client.js',()=>({tables:{},readAll:vi.fn(),sb:{rpc:vi.fn(),from:vi.fn()}}));
afterEach(cleanup);
it('closes the lesson editor without changing the open academic sheet',()=>{
 const d=fixture();render(<Groups d={d}/>);
 fireEvent.click(screen.getByRole('button',{name:'Group One',exact:true}));
 fireEvent.click(screen.getByRole('button',{name:'+ Add Lesson',exact:true}));
 expect(screen.getByRole('button',{name:'Save lesson'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Cancel',exact:true}));
 expect(screen.queryByRole('button',{name:'Save lesson'})).toBeNull();
 expect(screen.getByText('Group One — Academic Sheet')).toBeTruthy();
});
const fixture=()=>({students:[{id:'s',full_name:'Student One',status:'active'},{id:'old',full_name:'Old Student',status:'left'}],groups:[{id:'g',name:'Group One'}],members:[{group_id:'g',student_id:'s',active:true},{group_id:'g',student_id:'old',active:false}],metrics:[],intakes:[],teachers:[],lessons:[],exams:[],scores:[],attendance:[],homework:[],rosters:[{group_id:'g',student_id:'s',period_month:'2026-10-01',status:'active'}]});
it('uses source monthly rosters instead of missing historical join dates',()=>{
 const d=fixture();d.rosters.push({group_id:'other',student_id:'s',period_month:'2026-10-01',status:'active'},{group_id:'g',student_id:'old',period_month:'2026-10-01',status:'left'});
 expect(dashboardCounts(d,'2026-10')).toEqual({active:1,left:1,groups:2,lessons:0});
});
it('opens the month roster even when its lesson dates are pending',()=>{
 const d=fixture();render(<AcademicSheet g={d.groups[0]} d={d}/>);
 expect(screen.getByRole('combobox',{name:'Month',exact:true}).value).toBe('2026-10');
 expect(screen.getByText('Student One')).toBeTruthy();expect(screen.queryByText('Old Student')).toBeNull();
 expect(screen.getByText('No lessons in this month.')).toBeTruthy();
});
it('does not count new arrivals as retained members of an older cohort',()=>{
 const d=fixture();d.metrics=[{group_id:'g',course_month:1,student_count:2},{group_id:'g',course_month:2,student_count:3,retained_from_previous:2,baseline_from_previous:2}];
 render(<Groups d={d}/>);expect(screen.getByText('100%')).toBeTruthy();expect(screen.queryByText('150%')).toBeNull();
});
it('adds students through one atomic server call and reports a denied save',async()=>{
 const alert=vi.spyOn(window,'alert').mockImplementation(()=>{});sb.rpc.mockResolvedValue({error:{message:'Not authorized'}});
 render(<Students d={fixture()}/>);
 fireEvent.change(screen.getByLabelText('Student name'),{target:{value:'New Student'}});fireEvent.change(screen.getByLabelText('Phone'),{target:{value:'901112233'}});fireEvent.change(screen.getByLabelText('Student group'),{target:{value:'g'}});fireEvent.change(screen.getByLabelText('Joined date'),{target:{value:'2026-10-18'}});
 fireEvent.click(screen.getByRole('button',{name:'+ Add Student'}));await waitFor(()=>expect(alert).toHaveBeenCalledWith('Not authorized'));
 expect(sb.rpc).toHaveBeenCalledWith('admin_create_student',{p_name:'New Student',p_phone:'901112233',p_group_id:'g',p_joined_at:'2026-10-18'});
});
it('adds the created student to the page without a full data reload',async()=>{
 const refresh=vi.fn(),saved=vi.fn();sb.rpc.mockResolvedValue({data:'new-student'});
 sb.from.mockImplementation(table=>({select:()=>({eq:(first,value)=>({eq:(second,other)=>({single:async()=>({data:{id:'membership',student_id:value,group_id:other}})}),single:async()=>({data:{id:value,full_name:'New Student',status:'active'}})})})}));
 render(<Students d={fixture()} refresh={refresh} onRecordSaved={saved}/>);
 fireEvent.change(screen.getByLabelText('Student name'),{target:{value:'New Student'}});fireEvent.change(screen.getByLabelText('Student group'),{target:{value:'g'}});fireEvent.change(screen.getByLabelText('Joined date'),{target:{value:'2026-10-18'}});
 fireEvent.click(screen.getByRole('button',{name:'+ Add Student'}));
 await waitFor(()=>expect(saved).toHaveBeenCalledTimes(2));
 expect(refresh).not.toHaveBeenCalled();
 expect(saved).toHaveBeenNthCalledWith(1,'students',{id:'new-student',full_name:'New Student',status:'active'});
 expect(saved).toHaveBeenNthCalledWith(2,'members',{id:'membership',student_id:'new-student',group_id:'g'});
});
