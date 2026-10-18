-- Academic admins can change academic records without granting finance access.
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'groups', 'students', 'group_students', 'group_student_months', 'intakes',
    'lessons', 'attendance', 'homework', 'exams', 'exam_scores',
    'student_status_history', 'teachers', 'cover_lessons'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS academic_admin_manage ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY academic_admin_manage ON public.%I FOR ALL TO authenticated USING (public.is_active_academic_admin()) WITH CHECK (public.is_active_academic_admin())',
      tbl
    );
  END LOOP;
END $$;

-- Restrict broad read policies for payroll and finance records.
DROP POLICY IF EXISTS "payroll read" ON public.group_payroll;
CREATE POLICY "payroll read" ON public.group_payroll FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.active
    AND p.role::text IN ('owner_admin', 'academic_manager', 'finance'))
);

DROP POLICY IF EXISTS "period read" ON public.payroll_periods;
CREATE POLICY "period read" ON public.payroll_periods FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.active
    AND p.role::text IN ('owner_admin', 'academic_manager', 'finance'))
);

DROP POLICY IF EXISTS "forecast read" ON public.finance_forecasts;
CREATE POLICY "forecast read" ON public.finance_forecasts FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.active
    AND p.role::text IN ('owner_admin', 'academic_manager', 'finance'))
);

DROP POLICY IF EXISTS "finance assumptions read" ON public.finance_model_assumptions;
CREATE POLICY "finance assumptions read" ON public.finance_model_assumptions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.active
    AND p.role::text IN ('owner_admin', 'academic_manager', 'finance'))
);
