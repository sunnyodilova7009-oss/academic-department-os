import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {BulkMarks} from './academic-bulk.jsx';
import {sb} from './client.js';
vi.mock('./client.js',()=>({sb:{from:vi.fn()}}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const base={lesson:{id:'l',lesson_number:4,lesson_date:'2026-10-28'},groupName:'Group One',students:[{id:'a',full_name:'Ali'},{id:'b',full_name:'Zara'}],records:[{student_id:'a',status:'present'}],type:'attendance'};
it('reviews without writing, saves only changed rows and keeps exceptions',async()=>{
 const saved=vi.fn(),upsert=vi.fn(rows=>({select:async()=>({data:rows})}));
 sb.from.mockReturnValue({upsert});
 render(<BulkMarks {...base} onSaved={saved}/>);
 expect(upsert).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Zara attendance'),{target:{value:'absent'}});
 fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
 await waitFor(()=>expect(saved).toHaveBeenCalledOnce());
 expect(upsert).toHaveBeenCalledWith([{lesson_id:'l',student_id:'b',status:'absent'}],{onConflict:'lesson_id,student_id'});
 expect(sb.from).toHaveBeenCalledWith('attendance');
});
it('cancel never writes changes',()=>{
 const cancel=vi.fn();
 render(<BulkMarks {...base} onCancel={cancel}/>);
 fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
 expect(cancel).toHaveBeenCalledOnce();expect(sb.from).not.toHaveBeenCalled();
});
it('retains homework exceptions on failure and retries them',async()=>{
 const saved=vi.fn(),select=vi.fn().mockResolvedValueOnce({error:{message:'connection lost'}}).mockResolvedValueOnce({data:[{lesson_id:'l',student_id:'a',status:'partial'},{lesson_id:'l',student_id:'b',status:'done'}]});
 const upsert=vi.fn(()=>({select}));sb.from.mockReturnValue({upsert});
 render(<BulkMarks {...base} type="homework" records={[]} onSaved={saved}/>);
 fireEvent.change(screen.getByLabelText('Ali homework'),{target:{value:'partial'}});
 fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
 expect((await screen.findByRole('alert')).textContent).toContain('Your choices are still here');
 expect(saved).not.toHaveBeenCalled();expect(screen.getByLabelText('Ali homework').value).toBe('partial');
 fireEvent.click(screen.getByRole('button',{name:'Retry save'}));
 await waitFor(()=>expect(saved).toHaveBeenCalledOnce());
 expect(upsert.mock.calls[0]).toEqual(upsert.mock.calls[1]);
 expect(sb.from).toHaveBeenLastCalledWith('homework');
});
it('prevents double submissions while saving',async()=>{
 let finish;const select=vi.fn(()=>new Promise(resolve=>{finish=resolve;}));
 sb.from.mockReturnValue({upsert:()=>({select})});
 render(<BulkMarks {...base} onSaved={vi.fn()}/>);
 const save=screen.getByRole('button',{name:'Save changes'});
 fireEvent.click(save);fireEvent.click(save);
 expect(select).toHaveBeenCalledOnce();expect(screen.getByRole('button',{name:'Cancel'}).disabled).toBe(true);
 finish({data:[]});await waitFor(()=>expect(screen.getByRole('button',{name:'Save changes'}).disabled).toBe(false));
});
