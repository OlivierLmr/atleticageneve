// Auto-migration runner for Cloudflare D1.
// Called on Worker startup so `wrangler deploy` alone is enough to keep the
// schema up to date — no separate `wrangler d1 migrations apply` step needed.

const MIGRATION_0001 = `
CREATE TABLE IF NOT EXISTS edition (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CHF',
  total_budget INTEGER NOT NULL DEFAULT 250000,
  stadium_meal_cost INTEGER NOT NULL DEFAULT 30,
  transport_airport_hotel_cost INTEGER NOT NULL DEFAULT 50,
  transport_hotel_stadium_cost INTEGER NOT NULL DEFAULT 30,
  notification_email TEXT NOT NULL,
  weight_pb INTEGER NOT NULL DEFAULT 25,
  weight_sb INTEGER NOT NULL DEFAULT 35,
  weight_ranking INTEGER NOT NULL DEFAULT 30,
  weight_cost INTEGER NOT NULL DEFAULT 10,
  bonus_eap INTEGER NOT NULL DEFAULT 5,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS event_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  discipline TEXT NOT NULL,
  gender TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS event (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES edition(id),
  catalog_id TEXT NOT NULL REFERENCES event_catalog(id),
  max_slots INTEGER NOT NULL DEFAULT 8,
  int_minima REAL NOT NULL,
  swiss_minima REAL NOT NULL,
  eap_minima REAL,
  meet_record REAL,
  target_perf REAL,
  swiss_quota INTEGER NOT NULL DEFAULT 1,
  eap_quota INTEGER NOT NULL DEFAULT 1,
  prize_money_1st INTEGER NOT NULL DEFAULT 0,
  prize_money_2nd INTEGER NOT NULL DEFAULT 0,
  prize_money_3rd INTEGER NOT NULL DEFAULT 0,
  prize_money_4th INTEGER NOT NULL DEFAULT 0,
  prize_money_5th INTEGER NOT NULL DEFAULT 0,
  prize_money_6th INTEGER NOT NULL DEFAULT 0,
  prize_money_7th INTEGER NOT NULL DEFAULT 0,
  prize_money_8th INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS country (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS eap_city (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country_code TEXT NOT NULL REFERENCES country(code)
);

CREATE TABLE IF NOT EXISTS user (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  username TEXT,
  password_hash TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  organization TEXT,
  preferred_lang TEXT NOT NULL DEFAULT 'en',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email ON user(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_username ON user(username);

CREATE TABLE IF NOT EXISTS athlete (
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
  athlete_email TEXT,
  athlete_phone TEXT,
  negotiation_status TEXT NOT NULL DEFAULT 'to_review',
  decided_at TEXT,
  i_run_clean TEXT NOT NULL DEFAULT 'unknown',
  doping_free TEXT NOT NULL DEFAULT 'unknown',
  accommodation_reqs TEXT,
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

CREATE TABLE IF NOT EXISTS application (
  id TEXT PRIMARY KEY,
  athlete_id TEXT NOT NULL REFERENCES athlete(id),
  event_id TEXT NOT NULL REFERENCES event(id),
  edition_id TEXT NOT NULL REFERENCES edition(id),
  participation_status TEXT NOT NULL DEFAULT 'pending',
  personal_best REAL,
  season_best REAL,
  world_ranking INTEGER,
  score REAL,
  recommendation TEXT,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_application_athlete_event_edition
  ON application(athlete_id, event_id, edition_id);

CREATE TABLE IF NOT EXISTS hotel (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES edition(id),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hotel_room (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotel(id),
  room_type TEXT NOT NULL,
  cost_per_night INTEGER NOT NULL DEFAULT 0,
  dinner_cost INTEGER NOT NULL DEFAULT 0,
  reserved_rooms INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS agreement (
  id TEXT PRIMARY KEY,
  athlete_id TEXT NOT NULL REFERENCES athlete(id),
  version INTEGER NOT NULL DEFAULT 1,
  direction TEXT NOT NULL,
  appearance_fee INTEGER NOT NULL DEFAULT 0,
  other_compensation INTEGER NOT NULL DEFAULT 0,
  other_compensation_desc TEXT,
  transport INTEGER NOT NULL DEFAULT 0,
  transport_airport_hotel INTEGER NOT NULL DEFAULT 0,
  transport_hotel_stadium INTEGER NOT NULL DEFAULT 0,
  hotel_room_id TEXT REFERENCES hotel_room(id),
  hotel_night_tue INTEGER NOT NULL DEFAULT 0,
  hotel_night_wed INTEGER NOT NULL DEFAULT 0,
  hotel_night_thu INTEGER NOT NULL DEFAULT 0,
  hotel_night_fri INTEGER NOT NULL DEFAULT 0,
  hotel_night_sat INTEGER NOT NULL DEFAULT 0,
  hotel_night_sun INTEGER NOT NULL DEFAULT 0,
  dinner_tue INTEGER NOT NULL DEFAULT 0,
  dinner_wed INTEGER NOT NULL DEFAULT 0,
  dinner_thu INTEGER NOT NULL DEFAULT 0,
  dinner_fri INTEGER NOT NULL DEFAULT 0,
  dinner_sat INTEGER NOT NULL DEFAULT 0,
  dinner_sun INTEGER NOT NULL DEFAULT 0,
  stadium_meals INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  total_cost INTEGER NOT NULL DEFAULT 0,
  sent_by TEXT REFERENCES user(id),
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS interaction (
  id TEXT PRIMARY KEY,
  athlete_id TEXT NOT NULL REFERENCES athlete(id),
  application_id TEXT REFERENCES application(id),
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id TEXT REFERENCES user(id),
  author_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_log (
  id TEXT PRIMARY KEY,
  "to" TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  lang TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  related_athlete_id TEXT REFERENCES athlete(id)
);

CREATE TABLE IF NOT EXISTS wa_performance (
  id TEXT PRIMARY KEY,
  athlete_id TEXT NOT NULL REFERENCES athlete(id),
  event_id TEXT NOT NULL REFERENCES event(id),
  personal_best REAL,
  season_best REAL,
  world_ranking INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_perf_athlete_event
  ON wa_performance(athlete_id, event_id);

CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS magic_link (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  redirect_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`

// These ALTER statements are safe to fail if the column already exists.
const MIGRATION_0002_STMTS = [
  'ALTER TABLE athlete ADD COLUMN club TEXT',
  'ALTER TABLE email_log ADD COLUMN html_body TEXT',
]

// Global flag: Worker instances re-use this across requests within the same isolate.
let migrated = false

export async function ensureMigrated(d1: D1Database): Promise<void> {
  if (migrated) return

  // Tracking table — compatible with wrangler d1 migrations apply format.
  await d1.exec(
    `CREATE TABLE IF NOT EXISTS d1_migrations (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       name TEXT UNIQUE NOT NULL,
       applied_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`
  )

  const { results } = await d1
    .prepare('SELECT name FROM d1_migrations')
    .all<{ name: string }>()
  const applied = new Set(results.map((r) => r.name))

  if (!applied.has('0001_spec_v3')) {
    await d1.exec(MIGRATION_0001)
    await d1.prepare('INSERT OR IGNORE INTO d1_migrations (name) VALUES (?)').bind('0001_spec_v3').run()
  }

  if (!applied.has('0002_spec_v4')) {
    for (const stmt of MIGRATION_0002_STMTS) {
      try {
        await d1.exec(stmt)
      } catch {
        // Column already exists — safe to ignore.
      }
    }
    await d1.prepare('INSERT OR IGNORE INTO d1_migrations (name) VALUES (?)').bind('0002_spec_v4').run()
  }

  migrated = true
}
