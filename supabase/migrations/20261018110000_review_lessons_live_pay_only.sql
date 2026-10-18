alter table public.lessons add column if not exists is_review boolean not null default false;

CREATE OR REPLACE FUNCTION public.recalculate_group_academic_payroll(p_group_id uuid, p_period date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
 v_period date:=date_trunc('month',p_period)::date; v_key text:=to_char(date_trunc('month',p_period),'YYYY-MM');
 v_period_id uuid; v_teacher_id uuid; v_lessons int:=0; v_students int:=0; v_present int:=0; v_hw_done int:=0;
begin
 -- Approved payroll is a historical record; edits must not silently rewrite it.
 if exists(select 1 from public.payroll_periods where period_month=v_period and status='approved') then return; end if;
 select id into v_period_id from public.payroll_periods where period_month=v_period;
 if v_period_id is null then insert into public.payroll_periods(period_month) values(v_period) returning id into v_period_id; end if;
 select teacher_id into v_teacher_id from public.groups where id=p_group_id;

 select count(*) into v_lessons from public.lessons l
 where l.group_id=p_group_id and l.lesson_date>=v_period and l.lesson_date<v_period+interval '1 month'
 and l.payroll_payable=true and l.is_review is not true and (l.source_period is null or l.source_period=v_key);

 select count(distinct a.student_id) into v_students from public.attendance a join public.lessons l on l.id=a.lesson_id
 where l.group_id=p_group_id and l.lesson_date>=v_period and l.lesson_date<v_period+interval '1 month'
 and l.payroll_payable=true and l.is_review is not true and (l.source_period is null or l.source_period=v_key);

 select count(*) into v_present from public.attendance a join public.lessons l on l.id=a.lesson_id
 where l.group_id=p_group_id and l.lesson_date>=v_period and l.lesson_date<v_period+interval '1 month'
 and l.payroll_payable=true and (l.source_period is null or l.source_period=v_key) and a.status='present';

 select count(*) into v_hw_done from public.homework h join public.lessons l on l.id=h.lesson_id
 where l.group_id=p_group_id and l.lesson_date>=v_period and l.lesson_date<v_period+interval '1 month'
 and l.payroll_payable=true and l.is_review is not true and (l.source_period is null or l.source_period=v_key) and h.status in ('done','partial');

 insert into public.group_payroll(payroll_period_id,group_id,teacher_id,active_students,completed_lessons,fixed_amount,attendance_count,attendance_amount,homework_count,homework_amount)
 values(v_period_id,p_group_id,v_teacher_id,v_students,v_lessons,round(v_students*50000.0*v_lessons/12),v_present,v_present*5000,v_hw_done,v_hw_done*3500)
 on conflict(payroll_period_id,group_id) do update set teacher_id=excluded.teacher_id,active_students=excluded.active_students,completed_lessons=excluded.completed_lessons,fixed_amount=excluded.fixed_amount,attendance_count=excluded.attendance_count,attendance_amount=excluded.attendance_amount,homework_count=excluded.homework_count,homework_amount=excluded.homework_amount,updated_at=now();
end $function$

