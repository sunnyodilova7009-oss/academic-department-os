-- Run after assessment-payroll-fix.sql. All fixture changes are rolled back.
begin;
do $test$
declare v_student uuid; v_score numeric; v_before numeric; v_count integer; v_snapshot jsonb;
begin
-- Empty duplicate must preserve the populated assessment.
perform public.recalculate_assessment_payroll('0145e4be-2ca6-4f38-93df-2eda1a061038');
if not exists(select 1 from group_payroll where id='3c997c9e-f46d-404f-98ad-e93a79b47a70' and assessed_students=8 and assessment_bonus=32000) then raise exception 'Empty duplicate wiped bonus'; end if;
select student_id,score into v_student,v_score from exam_scores where exam_id='a6834f46-7dee-496b-902a-85a1a87594d7' order by student_id limit 1;
insert into exam_scores(exam_id,student_id,test_score,score) values('0145e4be-2ca6-4f38-93df-2eda1a061038',v_student,90,90);
select assessed_students into v_count from group_payroll where id='3c997c9e-f46d-404f-98ad-e93a79b47a70';
if v_count<>8 then raise exception 'Student counted twice'; end if;
if not exists(select 1 from group_payroll where id='3c997c9e-f46d-404f-98ad-e93a79b47a70' and assessment_average=round((481-v_score+(v_score+90)/2)/8,2)) then raise exception 'Student average wrong'; end if;
-- Old clients send a stale score when clearing; normalization must remove it.
update exam_scores set test_score=null,speaking_score=null where exam_id='0145e4be-2ca6-4f38-93df-2eda1a061038' and student_id=v_student;
if exists(select 1 from exam_scores where exam_id='0145e4be-2ca6-4f38-93df-2eda1a061038' and student_id=v_student and score is not null) then raise exception 'Cleared score retained'; end if;
if not exists(select 1 from group_payroll where id='3c997c9e-f46d-404f-98ad-e93a79b47a70' and assessment_bonus=32000) then raise exception 'Cleared duplicate changed bonus'; end if;
-- Clearing all components removes students from the assessed count.
update exam_scores set test_score=null,speaking_score=null,score=null where exam_id='a6834f46-7dee-496b-902a-85a1a87594d7';
if not exists(select 1 from group_payroll where id='3c997c9e-f46d-404f-98ad-e93a79b47a70' and assessed_students=0 and assessment_average is null and assessment_bonus=0 and retention_bonus=56000) then raise exception 'Empty monthly assessment or retention wrong'; end if;
-- Genuine zero is distinct from missing and counts as assessed.
update exam_scores set speaking_score=0 where exam_id='a6834f46-7dee-496b-902a-85a1a87594d7' and student_id=v_student;
if not exists(select 1 from group_payroll where id='3c997c9e-f46d-404f-98ad-e93a79b47a70' and assessed_students=1 and assessment_average=0) then raise exception 'Real zero excluded'; end if;
update payroll_periods set status='approved' where id='23e75d31-fcbe-4457-8254-2d91a050124c';
select to_jsonb(p) into v_snapshot from group_payroll p where id='3c997c9e-f46d-404f-98ad-e93a79b47a70';
update exam_scores set speaking_score=100 where exam_id='a6834f46-7dee-496b-902a-85a1a87594d7' and student_id=v_student;
if (select to_jsonb(p) from group_payroll p where id='3c997c9e-f46d-404f-98ad-e93a79b47a70')<>v_snapshot then raise exception 'Approved payroll modified'; end if;
end $test$;
rollback;

