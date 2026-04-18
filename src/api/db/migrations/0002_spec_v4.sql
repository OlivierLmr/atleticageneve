-- Spec v4 additions
-- Club/Team field on athlete, HTML body storage on email_log

ALTER TABLE athlete ADD COLUMN club TEXT;
ALTER TABLE email_log ADD COLUMN html_body TEXT;
