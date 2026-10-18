import { expect, it } from 'vitest';
import { courseLessons, nextLessonNumber, dashboardCounts } from './logic.js';

it('continues imported monthly resets without rewriting the underlying rows', () => {
  const records = [
    {id:'b',group_id:'g',lesson_date:'2026-09-01',lesson_number:1},
    {id:'a',group_id:'g',lesson_date:'2026-08-29',lesson_number:17},
    {id:'c',group_id:'g',lesson_date:'2026-09-03',lesson_number:2},
    {id:'other',group_id:'other',lesson_date:'2026-09-05',lesson_number:99},
  ];
  const original = JSON.stringify(records);
  expect(courseLessons(records,'g').map(x=>[x.id,x.lesson_number])).toEqual([['a',17],['b',18],['c',19]]);
  expect(nextLessonNumber(records,'g')).toBe(20);
  expect(JSON.stringify(records)).toBe(original);
});
it('preserves an already continuous course and a real numbering gap',()=>{
  const records=[{id:'a',group_id:'g',lesson_date:'2026-08-29',lesson_number:12},{id:'b',group_id:'g',lesson_date:'2026-09-01',lesson_number:15}];
  expect(courseLessons(records,'g').map(x=>x.lesson_number)).toEqual([12,15]);
  expect(nextLessonNumber(records,'g')).toBe(16);
});
it('does not count undated departed imports as currently active',()=>{
  expect(dashboardCounts({lessons:[],students:[{status:'active'},{status:'left'},{status:'paused'}]},'2026-09').active).toBe(1);
});
