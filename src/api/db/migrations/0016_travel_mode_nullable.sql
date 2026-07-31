-- travel_mode used to default to 'plane', making it impossible to tell whether
-- an athlete actively chose a travel mode or the field was simply never
-- touched. Travel logistics tracking needs that distinction (no mode chosen
-- yet = logistics not started), so travel_mode now starts out NULL instead of
-- defaulting to 'plane'. SQLite has no ALTER COLUMN, so the table is rebuilt.
--
-- application/agreement/interaction/email_log/wa_performance all hold foreign
-- keys to athlete.id, so dropping athlete while those rows exist violates FK
-- constraints. `PRAGMA foreign_keys=OFF` is a no-op mid-transaction (wrangler
-- runs each migration file as one transaction), so defer_foreign_keys is used
-- instead: checks are postponed until commit, by which point __new_athlete has
-- already been renamed to athlete and every reference resolves again.
PRAGMA defer_foreign_keys=TRUE;

CREATE TABLE __new_athlete (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES user(id),
  manager_id TEXT REFERENCES user(id),
  edition_id TEXT REFERENCES edition(id),
  assigned_selector TEXT REFERENCES user(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth TEXT,
  nationality TEXT NOT NULL,
  gender TEXT NOT NULL,
  federation TEXT,
  is_eap INTEGER NOT NULL DEFAULT 0,
  is_swiss INTEGER NOT NULL DEFAULT 0,
  distance_from_gva INTEGER NOT NULL DEFAULT 0,
  wa_profile_url TEXT,
  swi_licence TEXT,
  honours TEXT,
  eap_city TEXT REFERENCES eap_city(id),
  club TEXT,
  athlete_email TEXT,
  athlete_phone TEXT,
  negotiation_status TEXT NOT NULL DEFAULT 'to_review',
  decided_at TEXT,
  i_run_clean TEXT NOT NULL DEFAULT 'unknown',
  doping_free TEXT NOT NULL DEFAULT 'unknown',
  accommodation_reqs TEXT,
  travel_mode TEXT,
  arrival_date TEXT,
  arrival_flight TEXT,
  arrival_from TEXT,
  arrival_time TEXT,
  departure_date TEXT,
  departure_flight TEXT,
  departure_to TEXT,
  departure_time TEXT,
  est_travel INTEGER NOT NULL DEFAULT 0,
  est_accommodation INTEGER NOT NULL DEFAULT 0,
  est_appearance INTEGER NOT NULL DEFAULT 0,
  est_total INTEGER NOT NULL DEFAULT 0,
  bank_iban TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_amount INTEGER,
  payment_date TEXT,
  payment_method TEXT,
  participant_notes TEXT,
  additional_notes TEXT,
  internal_notes TEXT,
  archived_at TEXT,
  updated_by TEXT REFERENCES user(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO __new_athlete (
  id, user_id, manager_id, edition_id, assigned_selector, first_name, last_name,
  date_of_birth, nationality, gender, federation, is_eap, is_swiss, distance_from_gva,
  wa_profile_url, swi_licence, honours, eap_city, club, athlete_email, athlete_phone,
  negotiation_status, decided_at, i_run_clean, doping_free, accommodation_reqs,
  travel_mode, arrival_date, arrival_flight, arrival_from, arrival_time,
  departure_date, departure_flight, departure_to, departure_time,
  est_travel, est_accommodation, est_appearance, est_total, bank_iban,
  payment_status, payment_amount, payment_date, payment_method,
  participant_notes, additional_notes, internal_notes, archived_at,
  updated_by, updated_at, created_at
)
SELECT
  id, user_id, manager_id, edition_id, assigned_selector, first_name, last_name,
  date_of_birth, nationality, gender, federation, is_eap, is_swiss, distance_from_gva,
  wa_profile_url, swi_licence, honours, eap_city, club, athlete_email, athlete_phone,
  negotiation_status, decided_at, i_run_clean, doping_free, accommodation_reqs,
  travel_mode, arrival_date, arrival_flight, arrival_from, arrival_time,
  departure_date, departure_flight, departure_to, departure_time,
  est_travel, est_accommodation, est_appearance, est_total, bank_iban,
  payment_status, payment_amount, payment_date, payment_method,
  participant_notes, additional_notes, internal_notes, archived_at,
  updated_by, updated_at, created_at
FROM athlete;

DROP TABLE athlete;
ALTER TABLE __new_athlete RENAME TO athlete;
