-- Seed data for Atletica Geneve
-- Based on prototype mock data

-- ── Edition ───────────────────────────────────────────────────────────────────
INSERT INTO edition (id, name, year, start_date, end_date, total_budget) VALUES
  ('ed-2026', 'Atletica Genève 2026', 2026, '2026-06-14', '2026-06-15', 250000);

-- ── Events ────────────────────────────────────────────────────────────────────
INSERT INTO event (id, edition_id, name, discipline, gender, perf_type, max_slots, int_minima, swiss_minima, meet_record, swiss_quota, eap_quota) VALUES
  ('100m-m',   'ed-2026', '100m Men',        'Sprint',           'M', 'MIN', 8, 10.00,  10.15,  '9.86',   1, 1),
  ('100m-f',   'ed-2026', '100m Women',      'Sprint',           'F', 'MIN', 8, 11.15,  11.30,  '10.95',  1, 1),
  ('400m-m',   'ed-2026', '400m Men',        'Sprint',           'M', 'MIN', 8, 44.90,  45.50,  '44.12',  1, 1),
  ('400m-h-f', 'ed-2026', '400mH Women',     'Hurdles',          'F', 'MIN', 8, 48.00,  49.00,  '52.10',  1, 1),
  ('1500m-m',  'ed-2026', '1500m Men',       'Middle Distance',  'M', 'MIN', 8, 213.50, 216.00, '3:29.50',1, 1),
  ('hj-m',     'ed-2026', 'High Jump Men',   'Jumps',            'M', 'MAX', 8, 2.30,   2.25,   '2.33',   1, 1),
  ('lj-f',     'ed-2026', 'Long Jump Women', 'Jumps',            'F', 'MAX', 8, 6.86,   6.70,   '7.01',   1, 1);

-- ── Users (collaborators & committee) ─────────────────────────────────────────
-- Password for all: "atletica2026" (bcrypt hash)
INSERT INTO user (id, role, username, password_hash, first_name, last_name, preferred_lang) VALUES
  ('u-sel-1', 'collaborator', 'pierre',  '$2a$10$LxQvJKqYsHzKQxOZqR5cGeZ.pMNFLXTg5KGHVNJnWJxGmxlL2yGfq', 'Pierre',  'Dupont',  'fr'),
  ('u-sel-2', 'collaborator', 'sophie',  '$2a$10$LxQvJKqYsHzKQxOZqR5cGeZ.pMNFLXTg5KGHVNJnWJxGmxlL2yGfq', 'Sophie',  'Martin',  'fr'),
  ('u-com-1', 'committee',    'admin',   '$2a$10$LxQvJKqYsHzKQxOZqR5cGeZ.pMNFLXTg5KGHVNJnWJxGmxlL2yGfq', 'Jean',    'Président', 'fr');

-- ── Users (managers) ──────────────────────────────────────────────────────────
INSERT INTO user (id, role, email, phone, first_name, last_name, organization, preferred_lang) VALUES
  ('u-mgr-1', 'manager', 'm.magnani@athletesgroup.it',  '+39 02 1234 5678', 'Marcello', 'Magnani',  'Athletes Group',   'en'),
  ('u-mgr-2', 'manager', 'j.smith@trackmanagement.com', '+1 310 555 0199',  'John',     'Smith',    'Track Management', 'en'),
  ('u-mgr-3', 'manager', 'k.berg@nordicathletics.no',   '+47 22 33 44 55',  'Kari',     'Berg',     'Nordic Athletics', 'en'),
  ('u-mgr-4', 'manager', 'a.mueller@swissrunning.ch',   '+41 31 567 8901',  'Anna',     'Mueller',  'Swiss Running',    'fr'),
  ('u-mgr-5', 'manager', 'p.jones@globaltrack.co.uk',   '+44 20 7946 0958', 'Peter',    'Jones',    'Global Track',     'en');

-- ── Athletes ──────────────────────────────────────────────────────────────────
INSERT INTO athlete (id, manager_id, first_name, last_name, date_of_birth, nationality, gender, federation, is_eap, is_swiss, distance_from_gva) VALUES
  ('ath-1',  'u-mgr-1', 'Marcell',    'Jacobs',              '1994-09-26', 'ITA', 'M', 'FIDAL',            0, 0, 880),
  ('ath-2',  'u-mgr-2', 'Oblique',    'Seville',             '1997-01-22', 'JAM', 'M', 'JAAA',             0, 0, 8400),
  ('ath-3',  'u-mgr-4', 'Alex',       'Wilson',              '1994-08-19', 'SUI', 'M', 'Swiss Athletics',  1, 1, 100),
  ('ath-4',  'u-mgr-2', 'Sha''Carri', 'Richardson',          '2000-03-25', 'USA', 'F', 'USATF',            0, 0, 8200),
  ('ath-5',  'u-mgr-4', 'Mujinga',    'Kambundji',           '1992-06-17', 'SUI', 'F', 'Swiss Athletics',  1, 1, 100),
  ('ath-6',  'u-mgr-5', 'Dafne',      'Schippers',           '1992-06-15', 'NED', 'F', 'KNAU',             0, 0, 750),
  ('ath-7',  'u-mgr-5', 'Matthew',    'Hudson-Smith',        '1994-10-26', 'GBR', 'M', 'UKA',              0, 0, 900),
  ('ath-8',  'u-mgr-3', 'Karsten',    'Warholm',             '1996-02-28', 'NOR', 'M', 'NIF',              0, 0, 1800),
  ('ath-9',  'u-mgr-2', 'Sydney',     'McLaughlin-Levrone',  '1999-08-07', 'USA', 'F', 'USATF',            0, 0, 8200),
  ('ath-10', 'u-mgr-3', 'Jakob',      'Ingebrigtsen',        '2000-09-19', 'NOR', 'M', 'NIF',              0, 0, 1800),
  ('ath-11', 'u-mgr-4', 'Dominic',    'Lobalu',              '1993-06-01', 'SUI', 'M', 'Swiss Athletics',  1, 1, 100),
  ('ath-12', 'u-mgr-1', 'Gianmarco',  'Tamberi',             '1992-06-01', 'ITA', 'M', 'FIDAL',            0, 0, 880),
  ('ath-13', 'u-mgr-5', 'Malaika',    'Mihambo',             '1994-02-03', 'GER', 'F', 'DLV',              0, 0, 700),
  ('ath-14', 'u-mgr-5', 'Anita',      'Włodarczyk',          '1985-08-08', 'POL', 'F', 'PZLA',             0, 0, 1300);

-- ── Applications ──────────────────────────────────────────────────────────────
INSERT INTO application (id, athlete_id, event_id, edition_id, assigned_selector, status, personal_best, personal_best_val, season_best, season_best_val, world_ranking, est_travel, est_accommodation, est_appearance, est_total, applied_at) VALUES
  ('app-1',  'ath-1',  '100m-m',   'ed-2026', 'u-sel-1', 'accepted',      '9.80',    9.80,    '9.95',   9.95,   3,  1200, 800,  15000, 17000, '2025-11-03'),
  ('app-2',  'ath-2',  '100m-m',   'ed-2026', 'u-sel-1', 'to_review',     '9.82',    9.82,    '9.92',   9.92,   5,  4900, 2000, 8000,  14900, '2025-11-05'),
  ('app-3',  'ath-3',  '100m-m',   'ed-2026', 'u-sel-2', 'to_review',     '10.03',   10.03,   '10.10',  10.10,  62, 200,  200,  2000,  2400,  '2025-11-06'),
  ('app-4',  'ath-4',  '100m-f',   'ed-2026', 'u-sel-1', 'accepted',      '10.71',   10.71,   '10.78',  10.78,  1,  4800, 2400, 14000, 21200, '2025-11-02'),
  ('app-5',  'ath-5',  '100m-f',   'ed-2026', 'u-sel-2', 'contract_sent', '10.89',   10.89,   '10.95',  10.95,  8,  200,  400,  5000,  5600,  '2025-11-04'),
  ('app-6',  'ath-6',  '100m-f',   'ed-2026', 'u-sel-2', 'rejected',      '10.77',   10.77,   '11.05',  11.05,  24, 1400, 800,  7200,  9400,  '2025-11-07'),
  ('app-7',  'ath-7',  '400m-m',   'ed-2026', 'u-sel-1', 'contract_sent', '44.35',   44.35,   '44.60',  44.60,  7,  1500, 1200, 9000,  11700, '2025-11-03'),
  ('app-8',  'ath-8',  '400m-h-f', 'ed-2026', 'u-sel-1', 'accepted',      '45.94',   45.94,   '46.10',  46.10,  1,  2400, 1200, 18000, 21600, '2025-11-01'),
  ('app-9',  'ath-9',  '400m-h-f', 'ed-2026', 'u-sel-2', 'counter_offer', '50.65',   50.65,   '51.20',  51.20,  1,  4800, 2400, 21000, 28200, '2025-11-02'),
  ('app-10', 'ath-10', '1500m-m',  'ed-2026', 'u-sel-1', 'accepted',      '3:26.73', 206.73,  '3:28.50',208.50, 1,  2400, 1200, 14000, 17600, '2025-11-01'),
  ('app-11', 'ath-11', '1500m-m',  'ed-2026', 'u-sel-2', 'to_review',     '3:30.12', 210.12,  '3:32.50',212.50, 18, 200,  200,  3000,  3400,  '2025-11-06'),
  ('app-12', 'ath-12', 'hj-m',     'ed-2026', 'u-sel-1', 'to_review',     '2.39m',   2.39,    '2.35m',  2.35,   2,  1200, 800,  11900, 13900, '2025-11-05'),
  ('app-13', 'ath-13', 'lj-f',     'ed-2026', 'u-sel-2', 'accepted',      '7.30m',   7.30,    '7.22m',  7.22,   1,  1000, 800,  10400, 12200, '2025-11-03'),
  ('app-14', 'ath-14', 'lj-f',     'ed-2026', 'u-sel-2', 'rejected',      '7.04m',   7.04,    '6.80m',  6.80,   41, 1800, 800,  4900,  7500,  '2025-11-07');

-- ── Contract offers for accepted/in-negotiation applications ──────────────────
INSERT INTO contract_offer (id, application_id, version, direction, bonus, transport, hotel_night_thu, hotel_night_fri, hotel_night_sat, catering, total_cost, sent_by) VALUES
  ('co-1', 'app-1',  1, 'to_athlete', 15000, 1200, 1, 1, 1, 300, 16950, 'u-sel-1'),
  ('co-2', 'app-4',  1, 'to_athlete', 14000, 4800, 1, 1, 1, 400, 19650, 'u-sel-1'),
  ('co-3', 'app-5',  1, 'to_athlete', 5000,  200,  1, 1, 0, 200, 5700,  'u-sel-2'),
  ('co-4', 'app-7',  1, 'to_athlete', 9000,  1500, 1, 1, 1, 300, 11250, 'u-sel-1'),
  ('co-5', 'app-8',  1, 'to_athlete', 18000, 2400, 1, 1, 1, 400, 21250, 'u-sel-1'),
  ('co-6', 'app-9',  1, 'to_athlete', 21000, 4800, 1, 1, 1, 500, 26750, 'u-sel-2'),
  ('co-7', 'app-10', 1, 'to_athlete', 14000, 2400, 1, 1, 1, 400, 17250, 'u-sel-1'),
  ('co-8', 'app-13', 1, 'to_athlete', 10400, 1000, 1, 1, 0, 300, 12000, 'u-sel-2');

-- Counter-offer from Sydney McLaughlin-Levrone
INSERT INTO contract_offer (id, application_id, version, direction, bonus, transport, hotel_night_thu, hotel_night_fri, hotel_night_sat, hotel_night_sun, catering, notes, total_cost) VALUES
  ('co-9', 'app-9', 2, 'to_organizer', 25000, 5500, 1, 1, 1, 1, 600, 'Athlete requests minimum fee of CHF 25,000 and additional night for recovery.', 31700);

-- ── Hotels ────────────────────────────────────────────────────────────────────
INSERT INTO hotel (id, edition_id, name, room_types, cost_per_night, total_rooms) VALUES
  ('htl-1', 'ed-2026', 'Hotel Métropole',     '["single","double","suite"]', 250, 30),
  ('htl-2', 'ed-2026', 'Hotel Cornavin',      '["single","double"]',         150, 50),
  ('htl-3', 'ed-2026', 'Ibis Genève Centre',  '["single","double"]',         100, 40);

-- ── Interactions (sample audit trail) ─────────────────────────────────────────
INSERT INTO interaction (id, application_id, type, content, author_id, author_name, created_at) VALUES
  ('int-1',  'app-1', 'status_change', 'Application received',               'u-sel-1', 'Pierre Dupont', '2025-11-03 10:00:00'),
  ('int-2',  'app-1', 'contract',      'Contract offer sent: CHF 16,950',    'u-sel-1', 'Pierre Dupont', '2025-11-10 14:30:00'),
  ('int-3',  'app-1', 'status_change', 'Athlete accepted the contract',      'u-sel-1', 'Pierre Dupont', '2025-11-12 09:15:00'),
  ('int-4',  'app-9', 'status_change', 'Application received',               'u-sel-2', 'Sophie Martin', '2025-11-02 11:00:00'),
  ('int-5',  'app-9', 'contract',      'Contract offer sent: CHF 26,750',    'u-sel-2', 'Sophie Martin', '2025-11-08 16:00:00'),
  ('int-6',  'app-9', 'counter_offer', 'Counter-offer received: CHF 31,700', 'u-sel-2', 'Sophie Martin', '2025-11-11 10:30:00');
