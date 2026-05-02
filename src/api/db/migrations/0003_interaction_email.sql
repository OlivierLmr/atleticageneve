-- Add email_log reference to interaction table
ALTER TABLE interaction ADD COLUMN email_log_id TEXT REFERENCES email_log(id);
