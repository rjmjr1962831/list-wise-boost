-- Allow anyone to view pipedrive field mappings (they're not sensitive)
CREATE POLICY "Anyone can view pipedrive field mappings"
ON pipedrive_field_mapping
FOR SELECT
USING (true);