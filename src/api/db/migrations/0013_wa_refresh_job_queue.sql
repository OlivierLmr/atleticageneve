-- Bulk WA/EA refresh jobs used to be processed by one long-lived background
-- task (waitUntil), which Cloudflare Workers doesn't guarantee runs to
-- completion — the isolate can be recycled mid-loop, silently freezing the
-- progress counter partway through. Processing now happens one athlete at a
-- time, driven by each status poll, so pending_athlete_ids tracks the queue
-- of athletes still left to process for a job.
ALTER TABLE wa_refresh_job ADD COLUMN pending_athlete_ids TEXT NOT NULL DEFAULT '[]';
