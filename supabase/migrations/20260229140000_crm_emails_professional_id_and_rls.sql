-- Add professional_id to crm_emails for sequence sends and CRM linking.
ALTER TABLE crm_emails ADD COLUMN IF NOT EXISTS professional_id uuid REFERENCES professionals(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS crm_emails_professional_idx ON crm_emails(professional_id);

-- Ensure CRM (admin_users) can read crm_emails so Email tab updates.
ALTER TABLE crm_emails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CRM admins can read crm_emails" ON crm_emails;
CREATE POLICY "CRM admins can read crm_emails"
  ON crm_emails FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.active = true
      AND admin_users.role IN ('admin', 'superadmin')
    )
  );

-- Allow service role / edge functions to insert (RLS is bypassed for service_role).
-- No INSERT policy needed for authenticated; CRM sends go through gmail-send edge function.

-- Ensure CRM can read crm_contact_activity and crm_tasks (Hot Leads tab).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'crm_contact_activity') THEN
    ALTER TABLE crm_contact_activity ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "CRM admins can read crm_contact_activity" ON crm_contact_activity;
    CREATE POLICY "CRM admins can read crm_contact_activity"
      ON crm_contact_activity FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND active = true AND role IN ('admin', 'superadmin'))
      );
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'crm_tasks') THEN
    ALTER TABLE crm_tasks ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "CRM admins can read crm_tasks" ON crm_tasks;
    CREATE POLICY "CRM admins can read crm_tasks"
      ON crm_tasks FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND active = true AND role IN ('admin', 'superadmin'))
      );
  END IF;
END $$;
