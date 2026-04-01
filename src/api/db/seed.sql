-- Seed data for Atletica Geneve — SPEC v3

-- ── Countries (subset for development) ──────────────────────────────────────
INSERT INTO country (code, name) VALUES
  ('SUI', 'Switzerland'),
  ('USA', 'United States'),
  ('JAM', 'Jamaica'),
  ('KEN', 'Kenya'),
  ('ETH', 'Ethiopia'),
  ('GBR', 'Great Britain'),
  ('FRA', 'France'),
  ('GER', 'Germany'),
  ('ITA', 'Italy'),
  ('NOR', 'Norway'),
  ('NED', 'Netherlands'),
  ('POL', 'Poland'),
  ('JPN', 'Japan'),
  ('ESP', 'Spain'),
  ('BEL', 'Belgium');

-- ── EAP Cities ──────────────────────────────────────────────────────────────
INSERT INTO eap_city (id, name, country_code) VALUES
  ('eap-geneva',   'Geneva',    'SUI'),
  ('eap-lausanne', 'Lausanne',  'SUI'),
  ('eap-zurich',   'Zurich',    'SUI');

-- ── Event Catalog ───────────────────────────────────────────────────────────
INSERT INTO event_catalog (id, name, discipline, gender) VALUES
  ('100m-m',    '100m',         'Course',   'M'),
  ('100m-f',    '100m',         'Course',   'F'),
  ('200m-m',    '200m',         'Course',   'M'),
  ('200m-f',    '200m',         'Course',   'F'),
  ('400m-m',    '400m',         'Course',   'M'),
  ('400m-f',    '400m',         'Course',   'F'),
  ('400mh-f',   '400mH',       'Course',   'F'),
  ('800m-m',    '800m',         'Course',   'M'),
  ('1500m-m',   '1500m',       'Course',   'M'),
  ('1500m-f',   '1500m',       'Course',   'F'),
  ('5000m-m',   '5000m',       'Course',   'M'),
  ('hj-m',      'High Jump',   'Concours', 'M'),
  ('hj-f',      'High Jump',   'Concours', 'F'),
  ('lj-m',      'Long Jump',   'Concours', 'M'),
  ('lj-f',      'Long Jump',   'Concours', 'F'),
  ('pv-m',      'Pole Vault',  'Concours', 'M'),
  ('sp-m',      'Shot Put',    'Concours', 'M'),
  ('sp-f',      'Shot Put',    'Concours', 'F');

-- ── Edition ─────────────────────────────────────────────────────────────────
INSERT INTO edition (id, name, year, start_date, end_date, currency, total_budget, stadium_meal_cost, transport_airport_hotel_cost, transport_hotel_stadium_cost, notification_email, weight_pb, weight_sb, weight_ranking, weight_cost, bonus_eap) VALUES
  ('ed-2026', 'Atletica Genève 2026', 2026, '2026-06-14', '2026-06-15', 'CHF', 250000, 30, 50, 30, 'collaborators@atleticageneve.ch', 25, 35, 30, 10, 5);

-- ── Events (this edition) ───────────────────────────────────────────────────
INSERT INTO event (id, edition_id, catalog_id, max_slots, int_minima, swiss_minima, eap_minima, meet_record, target_perf, swiss_quota, eap_quota, prize_money_1st, prize_money_2nd, prize_money_3rd) VALUES
  ('100m-m-2026',   'ed-2026', '100m-m',  8, 10.00,  10.15,  10.10, 9.86,   9.90,   1, 1, 5000, 3000, 2000),
  ('100m-f-2026',   'ed-2026', '100m-f',  8, 11.15,  11.30,  11.20, 10.95,  11.00,  1, 1, 5000, 3000, 2000),
  ('400m-m-2026',   'ed-2026', '400m-m',  8, 44.90,  45.50,  45.20, 44.12,  44.50,  1, 1, 4000, 2500, 1500),
  ('400mh-f-2026',  'ed-2026', '400mh-f', 8, 54.00,  55.00,  54.50, 52.10,  53.00,  1, 1, 4000, 2500, 1500),
  ('1500m-m-2026',  'ed-2026', '1500m-m', 8, 213.50, 216.00, NULL,  209.50, 211.00, 1, 1, 4000, 2500, 1500),
  ('hj-m-2026',     'ed-2026', 'hj-m',    8, 2.30,   2.25,   2.28,  2.33,   2.35,   1, 1, 4000, 2500, 1500),
  ('lj-f-2026',     'ed-2026', 'lj-f',    8, 6.86,   6.70,   6.80,  7.01,   7.00,   1, 1, 4000, 2500, 1500);

-- ── Users (collaborators & committee) ───────────────────────────────────────
-- Password for all: "atletica2026"
INSERT INTO user (id, role, username, password_hash, first_name, last_name, preferred_lang) VALUES
  ('u-sel-1', 'collaborator', 'pierre',  '$2a$10$LxQvJKqYsHzKQxOZqR5cGeZ.pMNFLXTg5KGHVNJnWJxGmxlL2yGfq', 'Pierre',  'Dupont',    'fr'),
  ('u-sel-2', 'collaborator', 'sophie',  '$2a$10$LxQvJKqYsHzKQxOZqR5cGeZ.pMNFLXTg5KGHVNJnWJxGmxlL2yGfq', 'Sophie',  'Martin',    'fr'),
  ('u-com-1', 'committee',    'admin',   '$2a$10$LxQvJKqYsHzKQxOZqR5cGeZ.pMNFLXTg5KGHVNJnWJxGmxlL2yGfq', 'Jean',    'Président', 'fr');

-- ── Users (managers) ────────────────────────────────────────────────────────
INSERT INTO user (id, role, email, phone, first_name, last_name, organization, preferred_lang) VALUES
  ('u-mgr-1', 'manager', 'm.magnani@athletesgroup.it',  '+39 02 1234 5678', 'Marcello', 'Magnani',  'Athletes Group',   'en'),
  ('u-mgr-2', 'manager', 'j.smith@trackmanagement.com', '+1 310 555 0199',  'John',     'Smith',    'Track Management', 'en'),
  ('u-mgr-3', 'manager', 'k.berg@nordicathletics.no',   '+47 22 33 44 55',  'Kari',     'Berg',     'Nordic Athletics', 'en'),
  ('u-mgr-4', 'manager', 'a.mueller@swissrunning.ch',   '+41 31 567 8901',  'Anna',     'Mueller',  'Swiss Running',    'fr'),
  ('u-mgr-5', 'manager', 'p.jones@globaltrack.co.uk',   '+44 20 7946 0958', 'Peter',    'Jones',    'Global Track',     'en');

-- ── Hotels ──────────────────────────────────────────────────────────────────
INSERT INTO hotel (id, edition_id, name) VALUES
  ('htl-1', 'ed-2026', 'Hotel Métropole'),
  ('htl-2', 'ed-2026', 'Hotel Cornavin'),
  ('htl-3', 'ed-2026', 'Ibis Genève Centre');

-- ── Hotel Rooms ─────────────────────────────────────────────────────────────
INSERT INTO hotel_room (id, hotel_id, room_type, cost_per_night, dinner_cost, reserved_rooms) VALUES
  ('rm-1', 'htl-1', 'Single', 250, 90, 10),
  ('rm-2', 'htl-1', 'Double', 350, 90, 15),
  ('rm-3', 'htl-1', 'Suite',  500, 90, 5),
  ('rm-4', 'htl-2', 'Single', 150, 70, 20),
  ('rm-5', 'htl-2', 'Double', 220, 70, 30),
  ('rm-6', 'htl-3', 'Single', 100, 50, 20),
  ('rm-7', 'htl-3', 'Double', 140, 50, 20);

-- ── Athletes ────────────────────────────────────────────────────────────────
INSERT INTO athlete (id, manager_id, edition_id, first_name, last_name, date_of_birth, nationality, gender, federation, is_eap, is_swiss, distance_from_gva, negotiation_status, decided_at, i_run_clean, doping_free, assigned_selector, est_travel, est_accommodation, est_appearance, est_total) VALUES
  ('ath-1',  'u-mgr-1', 'ed-2026', 'Marcell',    'Jacobs',              '1994-09-26', 'ITA', 'M', 'FIDAL',           0, 0, 880,  'confirmed',          '2025-11-12 09:15:00', 'yes', 'yes', 'u-sel-1', 1200, 800,  15000, 17000),
  ('ath-2',  'u-mgr-2', 'ed-2026', 'Oblique',    'Seville',             '1997-01-22', 'JAM', 'M', 'JAAA',            0, 0, 8400, 'to_review',          NULL,                  'unknown', 'unknown', 'u-sel-1', 4900, 2000, 8000,  14900),
  ('ath-3',  'u-mgr-4', 'ed-2026', 'Alex',       'Wilson',              '1994-08-19', 'SUI', 'M', 'Swiss Athletics', 0, 1, 100,  'to_review',          NULL,                  'unknown', 'unknown', 'u-sel-2', 200,  200,  2000,  2400),
  ('ath-4',  'u-mgr-2', 'ed-2026', 'Sha''Carri', 'Richardson',          '2000-03-25', 'USA', 'F', 'USATF',           0, 0, 8200, 'confirmed',          '2025-11-13 11:00:00', 'yes', 'yes', 'u-sel-1', 4800, 2400, 14000, 21200),
  ('ath-5',  'u-mgr-4', 'ed-2026', 'Mujinga',    'Kambundji',           '1992-06-17', 'SUI', 'F', 'Swiss Athletics', 0, 1, 100,  'agreement_sent',     NULL,                  'yes', 'yes', 'u-sel-2', 200,  400,  5000,  5600),
  ('ath-6',  'u-mgr-5', 'ed-2026', 'Dafne',      'Schippers',           '1992-06-15', 'NED', 'F', 'KNAU',            0, 0, 750,  'rejected',           '2025-11-09 16:00:00', 'unknown', 'unknown', 'u-sel-2', 1400, 800,  7200,  9400),
  ('ath-7',  'u-mgr-5', 'ed-2026', 'Matthew',    'Hudson-Smith',        '1994-10-26', 'GBR', 'M', 'UKA',             0, 0, 900,  'agreement_sent',     NULL,                  'unknown', 'unknown', 'u-sel-1', 1500, 1200, 9000,  11700),
  ('ath-8',  'u-mgr-3', 'ed-2026', 'Karsten',    'Warholm',             '1996-02-28', 'NOR', 'M', 'NIF',             0, 0, 1800, 'confirmed',          '2025-11-14 08:30:00', 'yes', 'yes', 'u-sel-1', 2400, 1200, 18000, 21600),
  ('ath-9',  'u-mgr-2', 'ed-2026', 'Sydney',     'McLaughlin-Levrone',  '1999-08-07', 'USA', 'F', 'USATF',           0, 0, 8200, 'counter_offer_sent', NULL,                  'yes', 'yes', 'u-sel-2', 4800, 2400, 21000, 28200),
  ('ath-10', 'u-mgr-3', 'ed-2026', 'Jakob',      'Ingebrigtsen',        '2000-09-19', 'NOR', 'M', 'NIF',             0, 0, 1800, 'confirmed',          '2025-11-15 10:00:00', 'yes', 'yes', 'u-sel-1', 2400, 1200, 14000, 17600),
  ('ath-11', 'u-mgr-4', 'ed-2026', 'Dominic',    'Lobalu',              '1993-06-01', 'SUI', 'M', 'Swiss Athletics', 0, 1, 100,  'to_review',          NULL,                  'unknown', 'unknown', 'u-sel-2', 200,  200,  3000,  3400),
  ('ath-12', 'u-mgr-1', 'ed-2026', 'Gianmarco',  'Tamberi',             '1992-06-01', 'ITA', 'M', 'FIDAL',           0, 0, 880,  'to_review',          NULL,                  'unknown', 'unknown', 'u-sel-1', 1200, 800,  11900, 13900),
  ('ath-13', 'u-mgr-5', 'ed-2026', 'Malaika',    'Mihambo',             '1994-02-03', 'GER', 'F', 'DLV',             0, 0, 700,  'confirmed',          '2025-11-16 14:00:00', 'yes', 'yes', 'u-sel-2', 1000, 800,  10400, 12200),
  ('ath-14', 'u-mgr-5', 'ed-2026', 'Anita',      'Włodarczyk',          '1985-08-08', 'POL', 'F', 'PZLA',            0, 0, 1300, 'rejected',           '2025-11-10 09:00:00', 'unknown', 'unknown', 'u-sel-2', 1800, 800,  4900,  7500);

-- ── Applications (simplified — no logistics/payment) ────────────────────────
INSERT INTO application (id, athlete_id, event_id, edition_id, participation_status, personal_best, season_best, world_ranking, applied_at) VALUES
  ('app-1',  'ath-1',  '100m-m-2026',  'ed-2026', 'selected',     9.80,   9.95,   3,  '2025-11-03'),
  ('app-2',  'ath-2',  '100m-m-2026',  'ed-2026', 'pending',      9.82,   9.92,   5,  '2025-11-05'),
  ('app-3',  'ath-3',  '100m-m-2026',  'ed-2026', 'pending',      10.03,  10.10,  62, '2025-11-06'),
  ('app-4',  'ath-4',  '100m-f-2026',  'ed-2026', 'selected',     10.71,  10.78,  1,  '2025-11-02'),
  ('app-5',  'ath-5',  '100m-f-2026',  'ed-2026', 'selected',     10.89,  10.95,  8,  '2025-11-04'),
  ('app-6',  'ath-6',  '100m-f-2026',  'ed-2026', 'not_selected', 10.77,  11.05,  24, '2025-11-07'),
  ('app-7',  'ath-7',  '400m-m-2026',  'ed-2026', 'selected',     44.35,  44.60,  7,  '2025-11-03'),
  ('app-8',  'ath-8',  '400mh-f-2026', 'ed-2026', 'selected',     45.94,  46.10,  1,  '2025-11-01'),
  ('app-9',  'ath-9',  '400mh-f-2026', 'ed-2026', 'selected',     50.65,  51.20,  1,  '2025-11-02'),
  ('app-10', 'ath-10', '1500m-m-2026', 'ed-2026', 'selected',     206.73, 208.50, 1,  '2025-11-01'),
  ('app-11', 'ath-11', '1500m-m-2026', 'ed-2026', 'pending',      210.12, 212.50, 18, '2025-11-06'),
  ('app-12', 'ath-12', 'hj-m-2026',    'ed-2026', 'pending',      2.39,   2.35,   2,  '2025-11-05'),
  ('app-13', 'ath-13', 'lj-f-2026',    'ed-2026', 'selected',     7.30,   7.22,   1,  '2025-11-03'),
  ('app-14', 'ath-14', 'lj-f-2026',    'ed-2026', 'not_selected', 7.04,   6.80,   41, '2025-11-07');

-- ── Agreements (athlete-level) ──────────────────────────────────────────────
INSERT INTO agreement (id, athlete_id, version, direction, appearance_fee, transport, transport_airport_hotel, transport_hotel_stadium, hotel_room_id, hotel_night_thu, hotel_night_fri, hotel_night_sat, dinner_thu, dinner_fri, stadium_meals, total_cost, sent_by) VALUES
  ('agr-1', 'ath-1',  1, 'to_athlete', 15000, 1200, 1, 1, 'rm-1', 1, 1, 1, 1, 1, 1, 17780, 'u-sel-1'),
  ('agr-2', 'ath-4',  1, 'to_athlete', 14000, 4800, 1, 1, 'rm-2', 1, 1, 1, 1, 1, 1, 20980, 'u-sel-1'),
  ('agr-3', 'ath-5',  1, 'to_athlete', 5000,  200,  1, 0, 'rm-4', 1, 1, 0, 1, 1, 1, 5870,  'u-sel-2'),
  ('agr-4', 'ath-7',  1, 'to_athlete', 9000,  1500, 1, 1, 'rm-4', 1, 1, 1, 1, 1, 1, 11310, 'u-sel-1'),
  ('agr-5', 'ath-8',  1, 'to_athlete', 18000, 2400, 1, 1, 'rm-1', 1, 1, 1, 1, 1, 1, 21610, 'u-sel-1'),
  ('agr-6', 'ath-9',  1, 'to_athlete', 21000, 4800, 1, 1, 'rm-2', 1, 1, 1, 1, 1, 1, 27780, 'u-sel-2'),
  ('agr-7', 'ath-10', 1, 'to_athlete', 14000, 2400, 1, 1, 'rm-1', 1, 1, 1, 1, 1, 1, 17610, 'u-sel-1'),
  ('agr-8', 'ath-13', 1, 'to_athlete', 10400, 1000, 1, 0, 'rm-5', 1, 1, 0, 1, 1, 1, 12250, 'u-sel-2');

-- Counter-offer from Sydney McLaughlin-Levrone
INSERT INTO agreement (id, athlete_id, version, direction, appearance_fee, transport, transport_airport_hotel, transport_hotel_stadium, hotel_room_id, hotel_night_thu, hotel_night_fri, hotel_night_sat, hotel_night_sun, dinner_thu, dinner_fri, dinner_sat, stadium_meals, notes, total_cost) VALUES
  ('agr-9', 'ath-9', 2, 'to_organizer', 25000, 5500, 1, 1, 'rm-2', 1, 1, 1, 1, 1, 1, 1, 1, 'Athlete requests minimum fee of CHF 25,000 and additional night for recovery.', 33140);

-- ── WA Performance ──────────────────────────────────────────────────────────
INSERT INTO wa_performance (id, athlete_id, event_id, personal_best, season_best, world_ranking) VALUES
  ('wp-1',  'ath-1',  '100m-m-2026',  9.80,   9.95,   3),
  ('wp-2',  'ath-2',  '100m-m-2026',  9.82,   9.92,   5),
  ('wp-3',  'ath-3',  '100m-m-2026',  10.03,  10.10,  62),
  ('wp-4',  'ath-4',  '100m-f-2026',  10.71,  10.78,  1),
  ('wp-5',  'ath-5',  '100m-f-2026',  10.89,  10.95,  8),
  ('wp-6',  'ath-6',  '100m-f-2026',  10.77,  11.05,  24),
  ('wp-7',  'ath-7',  '400m-m-2026',  44.35,  44.60,  7),
  ('wp-8',  'ath-8',  '400mh-f-2026', 45.94,  46.10,  1),
  ('wp-9',  'ath-9',  '400mh-f-2026', 50.65,  51.20,  1),
  ('wp-10', 'ath-10', '1500m-m-2026', 206.73, 208.50, 1),
  ('wp-11', 'ath-11', '1500m-m-2026', 210.12, 212.50, 18),
  ('wp-12', 'ath-12', 'hj-m-2026',    2.39,   2.35,   2),
  ('wp-13', 'ath-13', 'lj-f-2026',    7.30,   7.22,   1),
  ('wp-14', 'ath-14', 'lj-f-2026',    7.04,   6.80,   41);

-- ── Interactions (sample audit trail) ───────────────────────────────────────
INSERT INTO interaction (id, athlete_id, application_id, type, content, author_id, author_name, created_at) VALUES
  ('int-1', 'ath-1', 'app-1', 'status_change', 'Application received',               'u-sel-1', 'Pierre Dupont', '2025-11-03 10:00:00'),
  ('int-2', 'ath-1', 'app-1', 'agreement',     'Agreement offer sent: CHF 17,780',   'u-sel-1', 'Pierre Dupont', '2025-11-10 14:30:00'),
  ('int-3', 'ath-1', NULL,    'status_change', 'Athlete confirmed the agreement',     'u-sel-1', 'Pierre Dupont', '2025-11-12 09:15:00'),
  ('int-4', 'ath-9', 'app-9', 'status_change', 'Application received',               'u-sel-2', 'Sophie Martin', '2025-11-02 11:00:00'),
  ('int-5', 'ath-9', 'app-9', 'agreement',     'Agreement offer sent: CHF 27,780',   'u-sel-2', 'Sophie Martin', '2025-11-08 16:00:00'),
  ('int-6', 'ath-9', NULL,    'counter_offer', 'Counter-offer received: CHF 33,140', 'u-sel-2', 'Sophie Martin', '2025-11-11 10:30:00');
