-- travel_mode used to default to 'plane', making it impossible to tell whether
-- an athlete actively chose a travel mode or the field was simply never
-- touched. Travel logistics tracking needs that distinction (no mode chosen
-- yet = logistics not started), so travel_mode now starts out NULL instead of
-- defaulting to 'plane'.
--
-- SQLite has no ALTER COLUMN, so a rebuild is needed. The previous version of
-- this migration rebuilt the whole athlete table (CREATE __new_athlete /
-- copy / DROP TABLE athlete / RENAME), but application/agreement/interaction/
-- email_log/wa_performance all hold foreign keys to athlete.id, and dropping
-- athlete while those rows exist in production violates those FK constraints
-- (PRAGMA defer_foreign_keys did not prevent this against D1 in practice).
-- Reusing the ADD COLUMN / DROP COLUMN pattern from migrations 0014/0015
-- instead only rewrites the single column and never drops the athlete table
-- itself, so existing foreign keys are never invalidated.
ALTER TABLE athlete ADD COLUMN travel_mode_new TEXT;
UPDATE athlete SET travel_mode_new = travel_mode;
ALTER TABLE athlete DROP COLUMN travel_mode;
ALTER TABLE athlete RENAME COLUMN travel_mode_new TO travel_mode;
