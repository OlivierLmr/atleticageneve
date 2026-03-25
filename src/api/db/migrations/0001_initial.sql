-- Initial schema for Atletica Geneve

CREATE TABLE IF NOT EXISTS edition (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  total_budget INTEGER NOT NULL DEFAULT 250000,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS event (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES edition(id),
  name TEXT NOT NULL,
  discipline TEXT NOT NULL,
  gender TEXT NOT NULL CHECK(gender IN ('M','F')),
  perf_type TEXT NOT NULL CHECK(perf_type IN ('MIN','MAX')),
  max_slots INTEGER NOT NULL DEFAULT 8,
  int_minima REAL NOT NULL,
  swiss_minima REAL NOT NULL,
  eap_minima REAL,
  meet_record TEXT,
  target_perf TEXT,
  swiss_quota INTEGER NOT NULL DEFAULT 1,
  eap_quota INTEGER NOT NULL DEFAULT 1,
  prize_1st INTEGER DEFAULT 0,
  prize_2nd INTEGER DEFAULT 0,
  prize_3rd INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK(role IN ('athlete','manager','collaborator','committee')),
  email TEXT,
  phone TEXT,
  username TEXT,
  password_hash TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  organization TEXT,
  preferred_lang TEXT NOT NULL DEFAULT 'en' CHECK(preferred_lang IN ('en','fr')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email ON user(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_username ON user(username) WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS athlete (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES user(id),
  manager_id TEXT REFERENCES user(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth TEXT,
  nationality TEXT NOT NULL,
  gender TEXT NOT NULL CHECK(gender IN ('M','F')),
  federation TEXT,
  is_eap INTEGER NOT NULL DEFAULT 0,
  is_swiss INTEGER NOT NULL DEFAULT 0,
  distance_from_gva INTEGER DEFAULT 0,
  wa_profile_url TEXT,
  swi_licence TEXT,
  honours TEXT,
  eap_city TEXT,
  athlete_email TEXT,
  athlete_phone TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hotel (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES edition(id),
  name TEXT NOT NULL,
  room_types TEXT,
  cost_per_night INTEGER NOT NULL DEFAULT 0,
  total_rooms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS application (
  id TEXT PRIMARY KEY,
  athlete_id TEXT NOT NULL REFERENCES athlete(id),
  event_id TEXT NOT NULL REFERENCES event(id),
  edition_id TEXT NOT NULL REFERENCES edition(id),
  assigned_selector TEXT REFERENCES user(id),
  status TEXT NOT NULL DEFAULT 'to_review' CHECK(status IN ('to_review','contract_sent','counter_offer','accepted','rejected','withdrawn')),
  personal_best TEXT,
  personal_best_val REAL,
  season_best TEXT,
  season_best_val REAL,
  world_ranking INTEGER,
  perf_updated_at TEXT,
  est_travel INTEGER DEFAULT 0,
  est_accommodation INTEGER DEFAULT 0,
  est_appearance INTEGER DEFAULT 0,
  est_total INTEGER DEFAULT 0,
  score REAL,
  recommendation TEXT,
  hotel_id TEXT REFERENCES hotel(id),
  room_number TEXT,
  accommodation_reqs TEXT,
  arrival_date TEXT,
  arrival_flight TEXT,
  arrival_from TEXT,
  arrival_time TEXT,
  departure_date TEXT,
  departure_flight TEXT,
  departure_to TEXT,
  departure_time TEXT,
  i_run_clean TEXT DEFAULT 'unknown' CHECK(i_run_clean IN ('yes','no','in_progress','unknown')),
  doping_free TEXT DEFAULT 'unknown' CHECK(doping_free IN ('yes','no','unknown')),
  participant_notes TEXT,
  additional_notes TEXT,
  internal_notes TEXT,
  bank_iban TEXT,
  payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending','done')),
  payment_amount INTEGER,
  payment_date TEXT,
  payment_method TEXT CHECK(payment_method IN ('cash','bank','western_union','paypal','other')),
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(athlete_id, event_id, edition_id)
);

CREATE TABLE IF NOT EXISTS contract_offer (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES application(id),
  version INTEGER NOT NULL DEFAULT 1,
  direction TEXT NOT NULL CHECK(direction IN ('to_athlete','to_organizer')),
  bonus INTEGER NOT NULL DEFAULT 0,
  other_compensation INTEGER DEFAULT 0,
  transport INTEGER NOT NULL DEFAULT 0,
  local_transport INTEGER NOT NULL DEFAULT 0,
  hotel_night_tue INTEGER NOT NULL DEFAULT 0,
  hotel_night_wed INTEGER NOT NULL DEFAULT 0,
  hotel_night_thu INTEGER NOT NULL DEFAULT 0,
  hotel_night_fri INTEGER NOT NULL DEFAULT 0,
  hotel_night_sat INTEGER NOT NULL DEFAULT 0,
  hotel_night_sun INTEGER NOT NULL DEFAULT 0,
  catering INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  total_cost INTEGER NOT NULL DEFAULT 0,
  sent_by TEXT REFERENCES user(id),
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_contract_app ON contract_offer(application_id, version);

CREATE TABLE IF NOT EXISTS meal_option (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES edition(id),
  day TEXT NOT NULL,
  meal_type TEXT NOT NULL CHECK(meal_type IN ('breakfast','lunch','dinner')),
  venue TEXT NOT NULL,
  cost_pp INTEGER NOT NULL DEFAULT 0,
  capacity INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meal_booking (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES application(id),
  meal_option_id TEXT NOT NULL REFERENCES meal_option(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(application_id, meal_option_id)
);

CREATE TABLE IF NOT EXISTS interaction (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES application(id),
  type TEXT NOT NULL CHECK(type IN ('email','call','note','status_change','contract','counter_offer')),
  content TEXT NOT NULL,
  author_id TEXT REFERENCES user(id),
  author_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_interaction_app ON interaction(application_id);

CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_session_token ON session(token);

CREATE TABLE IF NOT EXISTS magic_link (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
