-- Phase 1: Deactivate 3 corrupt "Profile" records
UPDATE professionals 
SET active = false, updated_at = NOW()
WHERE id IN (
  '3b42d59e-3166-462b-8961-5753e6d4cd22',
  '0b71a3d7-d4e1-4320-9901-7da6d431607b',
  '4bec5c59-d579-4827-9b3e-be98ad66a2e1'
);