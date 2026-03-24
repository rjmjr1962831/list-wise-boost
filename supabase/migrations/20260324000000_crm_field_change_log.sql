CREATE TABLE IF NOT EXISTS crm_field_change_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id uuid REFERENCES professionals(id),
  field_name text NOT NULL,
  old_value text,
  new_value text,
  changed_by text DEFAULT 'crm_agent',
  changed_at timestamptz DEFAULT now()
);

CREATE INDEX idx_field_change_log_professional ON crm_field_change_log(professional_id);
CREATE INDEX idx_field_change_log_date ON crm_field_change_log(changed_at);

-- RLS: allow service role full access
ALTER TABLE crm_field_change_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON crm_field_change_log FOR ALL USING (true) WITH CHECK (true);
