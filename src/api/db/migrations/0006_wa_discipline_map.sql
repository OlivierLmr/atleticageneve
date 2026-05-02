-- WA discipline name mapping table with default seed data
CREATE TABLE IF NOT EXISTS wa_discipline_map (
  id TEXT PRIMARY KEY,
  wa_name TEXT NOT NULL,
  wa_ranking_slug TEXT,
  catalog_name TEXT NOT NULL
);

INSERT OR IGNORE INTO wa_discipline_map (id, wa_name, wa_ranking_slug, catalog_name) VALUES ('seed-100m', '100 Metres', '100m', '100m');
INSERT OR IGNORE INTO wa_discipline_map (id, wa_name, wa_ranking_slug, catalog_name) VALUES ('seed-200m', '200 Metres', '200m', '200m');
INSERT OR IGNORE INTO wa_discipline_map (id, wa_name, wa_ranking_slug, catalog_name) VALUES ('seed-400m', '400 Metres', '400m', '400m');
INSERT OR IGNORE INTO wa_discipline_map (id, wa_name, wa_ranking_slug, catalog_name) VALUES ('seed-400mh', '400 Metres Hurdles', '400mh', '400mH');
INSERT OR IGNORE INTO wa_discipline_map (id, wa_name, wa_ranking_slug, catalog_name) VALUES ('seed-800m', '800 Metres', '800m', '800m');
INSERT OR IGNORE INTO wa_discipline_map (id, wa_name, wa_ranking_slug, catalog_name) VALUES ('seed-1500m', '1500 Metres', '1500m', '1500m');
INSERT OR IGNORE INTO wa_discipline_map (id, wa_name, wa_ranking_slug, catalog_name) VALUES ('seed-5000m', '5000 Metres', '5000m', '5000m');
INSERT OR IGNORE INTO wa_discipline_map (id, wa_name, wa_ranking_slug, catalog_name) VALUES ('seed-hj', 'High Jump', 'high-jump', 'High Jump');
INSERT OR IGNORE INTO wa_discipline_map (id, wa_name, wa_ranking_slug, catalog_name) VALUES ('seed-lj', 'Long Jump', 'long-jump', 'Long Jump');
INSERT OR IGNORE INTO wa_discipline_map (id, wa_name, wa_ranking_slug, catalog_name) VALUES ('seed-pv', 'Pole Vault', 'pole-vault', 'Pole Vault');
INSERT OR IGNORE INTO wa_discipline_map (id, wa_name, wa_ranking_slug, catalog_name) VALUES ('seed-sp', 'Shot Put', 'shot-put', 'Shot Put');
