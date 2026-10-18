-- Academic admins can view finance records, but existing finance write policies
-- continue to exclude this role.
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'group_payroll', 'payroll_periods', 'student_payments',
    'finance_forecasts', 'finance_model_assumptions'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS academic_admin_finance_read_only ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY academic_admin_finance_read_only ON public.%I FOR SELECT TO authenticated USING (public.is_active_academic_admin())',
      tbl
    );
  END LOOP;
END $$;
