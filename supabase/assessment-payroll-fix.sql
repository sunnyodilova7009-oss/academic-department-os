-- Missing components are not a zero score. Preserve legacy score-only imports.
alter table public.exam_scores alter column score drop not null;
create or replace function public.academic_os_exam_score_normalize()
returns trigger language plpgsql set search_path to 'public' as $fn$
begin
 if new.test_score is not null or new.speaking_score is not null then
  new.score := round((coalesce(new.test_score,new.speaking_score)+coalesce(new.speaking_score,new.test_score))/2.0,2);
 elsif tg_op='UPDATE' then
  if old.test_score is not null or old.speaking_score is not null then new.score:=null; end if;
 end if;
 return new;
end $fn$;
-- Keep the existing function signature, ownership and grants.
create or replace function public.recalculate_assessment_payroll(p_exam_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $fn$
declare v_group uuid; v_date date; v_period date; v_avg numeric; v_count integer; v_rate numeric;
begin
 select group_id,exam_date into v_group,v_date from public.exams where id=p_exam_id;
 if v_group is null or v_date is null then return; end if;
 v_period:=date_trunc('month',v_date)::date;
 -- Serialize updates to the same open payroll row.
 perform gp.id from public.group_payroll gp join public.payroll_periods pp on pp.id=gp.payroll_period_id
 where gp.group_id=v_group and pp.period_month=v_period and pp.status='open' for update of gp;
 if not found then return; end if;
 select avg(student_score),count(*) into v_avg,v_count from (
  select es.student_id,avg(es.score) student_score
  from public.exam_scores es join public.exams e on e.id=es.exam_id
  where e.group_id=v_group and e.exam_date>=v_period and e.exam_date<(v_period+interval '1 month')
    and es.score is not null
  group by es.student_id
 ) students;
 v_rate:=case when v_avg>=90 then 12000 when v_avg>=80 then 8000 when v_avg>=70 then 6000 when v_avg>=60 then 4000 else 0 end;
 update public.group_payroll gp set assessment_average=v_avg,assessed_students=v_count,
 assessment_bonus=v_rate*v_count,assessment_status=case when v_count>0 then 'entered' else 'not_entered' end
 from public.payroll_periods pp where gp.payroll_period_id=pp.id and gp.group_id=v_group and pp.period_month=v_period and pp.status='open';
end $fn$;


