-- Athletes use the same travel mode for the whole trip (plane/train/road),
-- not a separate one per leg — collapse arrival/departure travel mode into a
-- single column. Arrival's mode is kept as the source of truth for existing rows.
ALTER TABLE athlete ADD COLUMN travel_mode TEXT NOT NULL DEFAULT 'plane';
UPDATE athlete SET travel_mode = arrival_travel_mode;
ALTER TABLE athlete DROP COLUMN arrival_travel_mode;
ALTER TABLE athlete DROP COLUMN departure_travel_mode;
