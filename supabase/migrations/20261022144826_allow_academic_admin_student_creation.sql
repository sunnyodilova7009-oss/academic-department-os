-- Verified as authenticated academic_admin with transaction rollback:
-- intake, group, student, membership and monthly roster creation succeed.
-- Duplicate student, inactive admin and unapproved user checks remain enforced.
CREATE OR REPLACE FUNCTION public.admin_create_student(p_name text, p_phone text, p_group_id uuid, p_joined_at date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_id uuid;
begin
 if not (coalesce(public.is_management(),false) or public.is_active_academic_admin()) then raise exception 'Not authorized';end if;
 if nullif(btrim(p_name),'') is null or p_joined_at is null then raise exception 'Name and joined date are required';end if;
 if not exists(select 1 from public.groups where id=p_group_id and active) then raise exception 'Choose an active group';end if;
 perform pg_advisory_xact_lock(hashtext(lower(btrim(p_name))||coalesce(p_phone,'')||p_group_id::text));
 if exists(select 1 from public.students where lower(btrim(full_name))=lower(btrim(p_name)) and coalesce(phone,'')=coalesce(nullif(btrim(p_phone),''),'')) then raise exception 'Student already exists. Search and activate the existing record instead.';end if;
 insert into public.students(full_name,phone,joined_at,status) values(btrim(p_name),nullif(btrim(p_phone),''),p_joined_at,'active') returning id into v_id;
 insert into public.group_students(group_id,student_id,joined_at,active) values(p_group_id,v_id,p_joined_at,true);
 insert into public.group_student_months(group_id,student_id,period_month,status,source_sheet) values(p_group_id,v_id,date_trunc('month',p_joined_at)::date,'active','Admin entry');
 return v_id;
end $function$;