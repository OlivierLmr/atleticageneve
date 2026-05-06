-- Move WA discipline mapping into event_catalog table
ALTER TABLE event_catalog ADD COLUMN wa_name TEXT;
ALTER TABLE event_catalog ADD COLUMN wa_ranking_slug TEXT;
DROP TABLE IF EXISTS wa_discipline_map;
