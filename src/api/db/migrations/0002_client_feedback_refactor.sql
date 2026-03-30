-- Migration 0002: Client feedback refactor (26.03.2026)
-- - Configurable costs on edition
-- - Negotiation status + compliance on athlete
-- - Participation status on application
-- - Enriched contract_offer (athlete-level, transport split, dinners, hotel, stadium meals)
-- - Magic link redirect URL
-- - WA performance reference table

-- ── Edition: configurable costs ──────────────────────────────────────────────
ALTER TABLE edition ADD COLUMN dinner_cost_pp INTEGER NOT NULL DEFAULT 80;
ALTER TABLE edition ADD COLUMN stadium_meal_cost INTEGER NOT NULL DEFAULT 30;
ALTER TABLE edition ADD COLUMN transport_airport_hotel_cost INTEGER NOT NULL DEFAULT 50;
ALTER TABLE edition ADD COLUMN transport_hotel_stadium_cost INTEGER NOT NULL DEFAULT 30;

-- ── Athlete: negotiation status + compliance ─────────────────────────────────
ALTER TABLE athlete ADD COLUMN negotiation_status TEXT NOT NULL DEFAULT 'to_review'
  CHECK(negotiation_status IN ('to_review','contract_sent','counter_offer','accepted','rejected','withdrawn'));
ALTER TABLE athlete ADD COLUMN i_run_clean TEXT DEFAULT 'unknown';
ALTER TABLE athlete ADD COLUMN doping_free TEXT DEFAULT 'unknown';
ALTER TABLE athlete ADD COLUMN edition_id TEXT REFERENCES edition(id);

-- ── Application: participation status ────────────────────────────────────────
ALTER TABLE application ADD COLUMN participation_status TEXT NOT NULL DEFAULT 'pending'
  CHECK(participation_status IN ('pending','selected','not_selected'));

-- ── Contract offer: enriched fields ──────────────────────────────────────────
ALTER TABLE contract_offer ADD COLUMN athlete_id TEXT REFERENCES athlete(id);
ALTER TABLE contract_offer ADD COLUMN other_compensation_desc TEXT;
ALTER TABLE contract_offer ADD COLUMN transport_airport_hotel INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contract_offer ADD COLUMN transport_hotel_stadium INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contract_offer ADD COLUMN hotel_id TEXT REFERENCES hotel(id);
ALTER TABLE contract_offer ADD COLUMN dinner_tue INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contract_offer ADD COLUMN dinner_wed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contract_offer ADD COLUMN dinner_thu INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contract_offer ADD COLUMN dinner_fri INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contract_offer ADD COLUMN dinner_sat INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contract_offer ADD COLUMN dinner_sun INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contract_offer ADD COLUMN stadium_meals INTEGER NOT NULL DEFAULT 0;

-- ── Magic link: redirect URL ─────────────────────────────────────────────────
ALTER TABLE magic_link ADD COLUMN redirect_url TEXT;

-- ── WA Performance reference table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wa_performance (
  id TEXT PRIMARY KEY,
  athlete_id TEXT NOT NULL REFERENCES athlete(id),
  event_id TEXT NOT NULL REFERENCES event(id),
  personal_best TEXT,
  personal_best_val REAL,
  season_best TEXT,
  season_best_val REAL,
  world_ranking INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_perf_athlete_event ON wa_performance(athlete_id, event_id);

-- ── Data migration ───────────────────────────────────────────────────────────

-- Copy compliance from first application to athlete
UPDATE athlete SET
  i_run_clean = COALESCE((SELECT a.i_run_clean FROM application a WHERE a.athlete_id = athlete.id LIMIT 1), 'unknown'),
  doping_free = COALESCE((SELECT a.doping_free FROM application a WHERE a.athlete_id = athlete.id LIMIT 1), 'unknown'),
  edition_id = (SELECT a.edition_id FROM application a WHERE a.athlete_id = athlete.id LIMIT 1);

-- Copy negotiation status from the "most advanced" application status
-- Priority: accepted > counter_offer > contract_sent > to_review > rejected > withdrawn
UPDATE athlete SET negotiation_status = COALESCE(
  (SELECT a.status FROM application a WHERE a.athlete_id = athlete.id AND a.status = 'accepted' LIMIT 1),
  (SELECT a.status FROM application a WHERE a.athlete_id = athlete.id AND a.status = 'counter_offer' LIMIT 1),
  (SELECT a.status FROM application a WHERE a.athlete_id = athlete.id AND a.status = 'contract_sent' LIMIT 1),
  (SELECT a.status FROM application a WHERE a.athlete_id = athlete.id AND a.status = 'to_review' LIMIT 1),
  (SELECT a.status FROM application a WHERE a.athlete_id = athlete.id AND a.status = 'rejected' LIMIT 1),
  (SELECT a.status FROM application a WHERE a.athlete_id = athlete.id AND a.status = 'withdrawn' LIMIT 1),
  'to_review'
);

-- Populate athlete_id on contract_offer from the application's athlete_id
UPDATE contract_offer SET athlete_id = (
  SELECT a.athlete_id FROM application a WHERE a.id = contract_offer.application_id
);

-- Set participation_status = 'selected' for accepted applications
UPDATE application SET participation_status = 'selected' WHERE status = 'accepted';

-- Copy PB/SB/ranking from application to wa_performance
INSERT INTO wa_performance (id, athlete_id, event_id, personal_best, personal_best_val, season_best, season_best_val, world_ranking)
SELECT
  'wp-' || a.athlete_id || '-' || a.event_id,
  a.athlete_id,
  a.event_id,
  a.personal_best,
  a.personal_best_val,
  a.season_best,
  a.season_best_val,
  a.world_ranking
FROM application a
WHERE a.personal_best_val IS NOT NULL;
