-- Add stage tracking to contact_enrichment_queue
ALTER TABLE contact_enrichment_queue 
ADD COLUMN stage text DEFAULT 'queued' CHECK (stage IN ('queued', 'memo23', 'press_research', 'synthesis', 'completed'));

-- Add index for performance
CREATE INDEX idx_queue_status_stage ON contact_enrichment_queue(status, stage);

-- Enable realtime for the queue table
ALTER TABLE contact_enrichment_queue REPLICA IDENTITY FULL;