-- Add authorRole to interaction table to track whether action was taken by staff or athlete/manager
ALTER TABLE interaction ADD COLUMN author_role TEXT NOT NULL DEFAULT 'collaborator';
