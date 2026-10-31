import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {dashboardCounts} from './logic.js';
import {AcademicSheet} from './components.jsx';
import {Students,Groups} from './legacy.jsx';
import {sb} from './client.js';
vi.mock('./client.js',()=>({tables:{},readAll:vi.fn(),sb:{rpc:vi.fn(),from:vi.fn()}}));
afterEach(cleanup);
it('saves bulk attendance back into the selected lesson controls',async()=>{
 const d=fixture();d.lessons=[{id:'lesson',group_id:'g',lesson_number:1,lesson_date:'2026-10-28'}];
 const saved=vi.fn();sb.from.mockReturnValue({upsert:rows=>({select:async()=>({data:rows})})});
 render(<AcademicSheet g={d.groups[0]} d={d} onRecordSaved={saved}/>);
 fireEvent.click(screen.getByRole('button',{name:'Mark everyone present'}));
 expect(screen.queryByRole('button',{name:'Mark everyone done'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
 await screen.findByRole('button',{name:'Mark everyone present'});
 expect(screen.getByRole('combobox',{name:'Student One LIVE'}).value).toBe('present');
 expect(screen.getByRole('status').textContent).toContain('Saved 1 attendance changes');
 expect(saved).toHaveBeenCalledWith('attendance',{lesson_id:'lesson',student_id:'s',status:'present'});
});
it('adds a teacher and immediately makes them selectable for a new group',async()=>{
 const insert=vi.fn(payload=>({select:()=>({single:async()=>({data:{id:'new-teacher',...payload}})})}));
 sb.from.mockReturnValue({insert});
 function Harness(){
  const [data,setData]=React.useState(fixture());
  return <Groups d={data} onRecordSaved={(table,row)=>setData(old=>({...old,[table]:[...old[table],row]}))}/>;
 }
 render(<Harness/>);
 fireEvent.click(screen.getByRole('button',{name:'+ Add Teacher'}));
 fireEvent.change(screen.getByLabelText('Teacher name'),{target:{value:'  New  Teacher  '}});
 fireEvent.click(screen.getByRole('button',{name:'Save teacher'}));
 await waitFor(()=>expect(screen.queryByRole('button',{name:'Save teacher'})).toBeNull());
 expect(insert).toHaveBeenCalledWith({name:'New Teacher',active:true});
 expect(sb.from).toHaveBeenLastCalledWith('teachers');
 expect(screen.getByRole('status').textContent).toContain('New Teacher added');
 fireEvent.click(screen.getByRole('button',{name:'+ Create Group'}));
 expect(screen.getByRole('option',{name:'New Teacher'}).value).toBe('new-teacher');
});
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
it('keeps the edited lesson selected across months with its attendance and homework',async()=>{
 const d=fixture();d.lessons=[{id:'l',group_id:'g',lesson_number:1,lesson_date:'2026-10-22'}];
 d.attendance=[{id:'a',lesson_id:'l',student_id:'s',status:'present'}];
 d.homework=[{id:'h',lesson_id:'l',student_id:'s',status:'done'}];
 sb.from.mockReturnValue({update:payload=>({eq:()=>({select:()=>({single:async()=>({data:{...d.lessons[0],...payload}})})})})});
 function Harness(){
  const [data,setData]=React.useState(d);
  return <AcademicSheet g={d.groups[0]} d={data} onRecordSaved={(table,row)=>setData(old=>({...old,[table]:old[table].map(x=>x.id===row.id?row:x)}))}/>;
 }
 render(<Harness/>);
 fireEvent.click(screen.getByRole('button',{name:/Edit lesson/}));
 fireEvent.change(screen.getByLabelText('Lesson date'),{target:{value:'2026-11-02'}});
 fireEvent.change(screen.getByLabelText('Lesson number'),{target:{value:'5'}});
 fireEvent.click(screen.getByRole('button',{name:'Save lesson'}));
 await waitFor(()=>expect(screen.queryByRole('button',{name:'Save lesson'})).toBeNull());
 expect(screen.getByRole('combobox',{name:'Month',exact:true}).value).toBe('2026-11');
 expect(screen.getByRole('combobox',{name:'Lesson',exact:true}).value).toBe('l');
 expect(screen.getByRole('button',{name:/L5/}).textContent).toContain('2026-11-02');
 const values=screen.getAllByRole('combobox').map(x=>x.value);
 expect(values).toContain('present');expect(values).toContain('done');
});
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

it('separates finished and closed early groups and keeps their academic sheets accessible',()=>{
 const d=fixture();d.groups.push({id:'finished',name:'Completed Group',active:false,closure_status:'finished'},{id:'early',name:'Stopped Group',active:false,closure_status:'closed_early'});
 render(<Groups d={d}/>);
 expect(screen.queryByRole('button',{name:'Completed Group',exact:true})).toBeNull();
 fireEvent.change(screen.getByLabelText('Group status filter'),{target:{value:'finished'}});
 expect(screen.getByRole('button',{name:'Completed Group',exact:true})).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Stopped Group',exact:true})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Completed Group',exact:true}));
 expect(screen.getByText('Completed Group — Academic Sheet')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'← Groups'}));
 fireEvent.change(screen.getByLabelText('Group status filter'),{target:{value:'closed_early'}});
 expect(screen.getByRole('button',{name:'Stopped Group',exact:true})).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Completed Group',exact:true})).toBeNull();
});
