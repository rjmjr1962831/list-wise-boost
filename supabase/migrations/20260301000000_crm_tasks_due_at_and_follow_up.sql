-- Add due_at to crm_tasks for N-day follow-up. When set, task only surfaces when due_at <= now().
ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS due_at timestamptz;

COMMENT ON COLUMN crm_tasks.due_at IS 'When set, task is shown in Pending only when due_at <= now(). Used for follow-up reminders.';

-- Notes entered when completing a task; shown when the (follow-up) task appears.
ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN crm_tasks.notes IS 'Completion/follow-up notes; displayed on the task card when the task surfaces.';

-- CRM admins need to INSERT (follow-up tasks) and UPDATE (mark done) on crm_tasks.
DROP POLICY IF EXISTS "CRM admins can insert crm_tasks" ON crm_tasks;
CREATE POLICY "CRM admins can insert crm_tasks"
  ON crm_tasks FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND active = true AND role IN ('admin', 'superadmin'))
  );

DROP POLICY IF EXISTS "CRM admins can update crm_tasks" ON crm_tasks;
CREATE POLICY "CRM admins can update crm_tasks"
  ON crm_tasks FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND active = true AND role IN ('admin', 'superadmin'))
  );

DROP POLICY IF EXISTS "CRM admins can delete crm_tasks" ON crm_tasks;
CREATE POLICY "CRM admins can delete crm_tasks"
  ON crm_tasks FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND active = true AND role IN ('admin', 'superadmin'))
  );
