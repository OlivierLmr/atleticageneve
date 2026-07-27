-- European Athletics ranking support
-- Adds a configurable per-edition threshold, a discipline mapping for scraping,
-- and the scraped ranking value itself.

ALTER TABLE edition ADD COLUMN ea_ranking_threshold INTEGER NOT NULL DEFAULT 30;
ALTER TABLE event_catalog ADD COLUMN ea_discipline TEXT;
ALTER TABLE wa_performance ADD COLUMN ea_ranking INTEGER;
