-- Add unique constraint to contact_enrichment_queue for upsert to work
ALTER TABLE contact_enrichment_queue 
ADD CONSTRAINT contact_enrichment_queue_professional_id_key 
UNIQUE (professional_id);