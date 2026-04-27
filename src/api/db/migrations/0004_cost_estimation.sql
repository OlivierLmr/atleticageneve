-- Cost estimation configuration tables
-- Adds configurable tier/distance cost tables and manager bonus per edition

ALTER TABLE edition ADD COLUMN manager_tier_bonus INTEGER NOT NULL DEFAULT 1;
ALTER TABLE country ADD COLUMN distance_from_gva INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS cost_tier_config (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES edition(id),
  tier INTEGER NOT NULL,
  ranking_min INTEGER,
  ranking_max INTEGER,
  appearance_fee INTEGER NOT NULL DEFAULT 0,
  nightly_rate INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cost_distance_config (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES edition(id),
  distance_max INTEGER,
  travel_cost INTEGER NOT NULL DEFAULT 0,
  nights INTEGER NOT NULL DEFAULT 0
);
