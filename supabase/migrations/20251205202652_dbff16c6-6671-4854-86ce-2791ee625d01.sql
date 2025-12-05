-- Fix: Restrict appointments table SELECT to admins only
DROP POLICY IF EXISTS "Anyone can view appointments" ON appointments;
CREATE POLICY "Admins can view appointments" ON appointments FOR SELECT USING (has_role(auth.uid(), 'admin'));