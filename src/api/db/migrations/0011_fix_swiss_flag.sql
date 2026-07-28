-- is_swiss used to be computed client-side and sent as a separate field on
-- registration; the manager batch-registration endpoint silently ignored it,
-- so athletes registered that way always got is_swiss = 0 regardless of
-- nationality. is_swiss is now always derived server-side from nationality.
-- Backfill existing rows so the flag matches nationality.
UPDATE athlete SET is_swiss = 1 WHERE nationality = 'SUI' AND is_swiss = 0;
UPDATE athlete SET is_swiss = 0 WHERE nationality != 'SUI' AND is_swiss = 1;
