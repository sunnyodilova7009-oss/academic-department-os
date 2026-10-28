alter table public.lessons add column course_number integer check (course_number > 0), add column numbering_date date;
comment on column public.lessons.course_number is 'Explicit course number edited by an admin; original imported lesson_number remains intact.';
comment on column public.lessons.numbering_date is 'Original date before editing, keeping the legacy course sequence stable.';
