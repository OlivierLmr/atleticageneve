-- Add final_placement to application (any positive integer, prize money only applied for 1-8)
ALTER TABLE application ADD COLUMN final_placement INTEGER;

-- Add bank_iban to user so managers can store their banking details
ALTER TABLE "user" ADD COLUMN bank_iban TEXT;
