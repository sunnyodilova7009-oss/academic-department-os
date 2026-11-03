import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {ScoreCells} from './components.jsx';
import {sb} from './client.js';
vi.mock('./client.js',()=>({sb:{from:vi.fn()},tables:{},readAll:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
function setup(result){
 const single=vi.fn().mockResolvedValue(result);
 const upsert=vi.fn(()=>({select:()=>({single})}));
 sb.from.mockReturnValue({upsert});
 const onSaved=vi.fn();
 render(<ScoreCells exam={{id:'exam',max_score:100}} student={{id:'student',full_name:'Ali'}} record={{score:85,test_score:90,speaking_score:80}} onSaved={onSaved}/>);
 return {upsert,onSaved};
}
it('clears both components without retaining the previous score',async()=>{
 const row={exam_id:'exam',student_id:'student',score:null,test_score:null,speaking_score:null};
 const {upsert,onSaved}=setup({data:row,error:null});
 fireEvent.change(screen.getByLabelText('Ali Test'),{target:{value:''}});
 fireEvent.change(screen.getByLabelText('Ali Speaking'),{target:{value:''}});
 fireEvent.click(screen.getByText('Save scores'));
 await waitFor(()=>expect(onSaved).toHaveBeenCalledWith(row));
 expect(upsert.mock.calls[0][0]).toEqual(row);
});
it('uses the normalized database result for a single remaining component',async()=>{
 const row={exam_id:'exam',student_id:'student',score:80,test_score:null,speaking_score:80};
 const {onSaved}=setup({data:row,error:null});
 fireEvent.change(screen.getByLabelText('Ali Test'),{target:{value:''}});
 fireEvent.click(screen.getByText('Save scores'));
 await waitFor(()=>expect(onSaved).toHaveBeenCalledWith(row));
});
it('keeps failed changes available to retry',async()=>{
 const {onSaved}=setup({data:null,error:{message:'Save failed'}});
 fireEvent.change(screen.getByLabelText('Ali Test'),{target:{value:''}});
 fireEvent.click(screen.getByText('Save scores'));
 await screen.findByRole('alert');
 expect(onSaved).not.toHaveBeenCalled();
 expect(screen.getByLabelText('Ali Test').value).toBe('');
});

