-- Support notes and calls are not part of the academic-admin workspace.
DROP POLICY IF EXISTS "student_notes_authenticated_read" ON public.student_notes;
CREATE POLICY "student_notes_authenticated_read" ON public.student_notes FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.active
    AND p.role::text IN ('owner_admin', 'academic_manager', 'teacher', 'student_support', 'finance'))
);

DROP POLICY IF EXISTS "support notes read" ON public.student_support_notes;
CREATE POLICY "support notes read" ON public.student_support_notes FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.active
    AND p.role::text IN ('owner_admin', 'academic_manager', 'teacher', 'student_support', 'finance'))
);

DROP POLICY IF EXISTS "calls read" ON public.support_calls;
CREATE POLICY "calls read" ON public.support_calls FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.active
    AND p.role::text IN ('owner_admin', 'academic_manager', 'teacher', 'student_support', 'finance'))
);
