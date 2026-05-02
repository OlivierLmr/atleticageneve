- Always run `npm run check` before committing. If any check fails, fix the issues and re-run until they pass.
- after each piece of work is done, commit it.
- do not deploy unless asked to.
- After deploying, test the deployment by trying to connect as admin (e.g. using curl). You should also check that the frontend is able to do the same (i.e. it communicates correctly with the backend and is able to log in).
- On this project, never hesitate to redesign things more fundamentally, with more drastic changes, even to the DB. It is always ok to have to reset the DB. This means that after any change, the result should be cohesive, and not feel like a stack of incremental changes.
  - If a component is getting messy from accumulated patches, feel free to rewrite it rather than surgically editing 3 lines.
  - If the file structure doesn't make sense anymore, feel free to reorganize it.
  - Don't preserve old patterns just because they exist — if something should be different, make it different.

## Database Migrations

Migrations use the standard wrangler D1 system. All schema changes must be SQL migration files.

- **Schema changes workflow**: Edit `src/api/db/schema.ts`, then run `npm run db:generate` to produce a new SQL migration file in `src/api/db/migrations/`. Review the generated SQL before committing.
- **Local dev**: `npm run db:migrate` applies pending migrations to the local D1 database.
- **Production**: Migrations must be applied manually before deploying: `npx wrangler d1 migrations apply atletica-db --remote`. The CI token currently lacks D1 permissions, so this cannot be automated in the deploy pipeline.
- **Never modify or delete existing migration files** — only add new ones. Existing migrations may already be applied in production.
- **All migrations must be SQL files** in `src/api/db/migrations/`. No inline TypeScript migration code.
