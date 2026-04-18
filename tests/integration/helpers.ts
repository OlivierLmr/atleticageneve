/**
 * Integration test helpers — creates a Miniflare instance with a fresh D1 database
 * and provides the Hono app bound to it.
 *
 * SPEC v3: event_catalog, country, eap_city reference tables; agreement replaces contractOffer;
 * event references catalog via catalogId; hotel split into hotel + hotel_room.
 */
import { Miniflare } from 'miniflare'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import * as schema from '@api/db/schema'
import { resetMigrationState } from '@api/db/migrate'
import app from '@api/index'
import fs from 'fs'
import path from 'path'

const MIGRATION_PATHS = [
  { file: path.resolve(__dirname, '../../src/api/db/migrations/0001_spec_v3.sql'), name: '0001_spec_v3' },
]

// MIGRATION_0002 ALTER statements — must match src/api/db/migrate.ts
const MIGRATION_0002_STMTS = [
  'ALTER TABLE athlete ADD COLUMN club TEXT',
  'ALTER TABLE email_log ADD COLUMN html_body TEXT',
]

const MIGRATION_0003_STMTS = [
  'ALTER TABLE interaction ADD COLUMN email_log_id TEXT REFERENCES email_log(id)',
]

export interface TestContext {
  mf: Miniflare
  db: ReturnType<typeof drizzle<typeof schema>>
  d1: D1Database
  request: (path: string, init?: RequestInit) => Promise<Response>
}

export async function setupTestContext(): Promise<TestContext> {
  // Reset migration flag so ensureMigrated() re-checks for this fresh DB
  resetMigrationState()

  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok") } }',
    d1Databases: { DB: 'test-db' },
  })

  const d1 = await mf.getD1Database('DB') as unknown as D1Database
  const db = drizzle(d1, { schema })

  // Create migration tracking table
  await d1.prepare(
    `CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, applied_at TEXT NOT NULL DEFAULT (datetime('now')))`
  ).run()

  // Run migration 0001 from SQL file
  for (const { file, name } of MIGRATION_PATHS) {
    const migrationSql = fs.readFileSync(file, 'utf-8')
    const statements = migrationSql
      .split(/;\s*\n/)
      .map((s) => s.replace(/--.*$/gm, '').trim())
      .filter((s) => s.length > 0)

    const batch = statements.map((s) => d1.prepare(s))
    await d1.batch(batch)

    // Record migration as applied so ensureMigrated() skips it
    await d1.prepare('INSERT OR IGNORE INTO d1_migrations (name) VALUES (?)').bind(name).run()
  }

  // Run migration 0002 (ALTER TABLE statements)
  for (const stmt of MIGRATION_0002_STMTS) {
    try {
      await d1.prepare(stmt).run()
    } catch {
      // Column already exists — safe to ignore
    }
  }
  await d1.prepare('INSERT OR IGNORE INTO d1_migrations (name) VALUES (?)').bind('0002_spec_v4').run()

  // Run migration 0003 (ALTER TABLE statements)
  for (const stmt of MIGRATION_0003_STMTS) {
    try {
      await d1.prepare(stmt).run()
    } catch {
      // Column already exists — safe to ignore
    }
  }
  await d1.prepare('INSERT OR IGNORE INTO d1_migrations (name) VALUES (?)').bind('0003_interaction_email').run()

  // Request helper
  const request = async (urlPath: string, init?: RequestInit): Promise<Response> => {
    const url = `http://localhost${urlPath}`
    const req = new Request(url, init)
    const env = { DB: d1 }
    return app.fetch(req, env as any, { waitUntil: () => {}, passThroughOnException: () => {} } as any)
  }

  return { mf, db, d1, request }
}

export async function teardownTestContext(ctx: TestContext) {
  await ctx.mf.dispose()
}

/** Helper to create a user and session, returns the bearer token */
export async function createUserWithSession(
  ctx: TestContext,
  userData: {
    id?: string
    role: string
    username?: string
    passwordHash?: string
    email?: string
    firstName?: string
    lastName?: string
  }
): Promise<{ userId: string; token: string }> {
  const userId = userData.id ?? crypto.randomUUID()
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  await ctx.db.insert(schema.user).values({
    id: userId,
    role: userData.role,
    username: userData.username ?? null,
    passwordHash: userData.passwordHash ?? null,
    email: userData.email ?? null,
    firstName: userData.firstName ?? 'Test',
    lastName: userData.lastName ?? 'User',
  })

  await ctx.db.insert(schema.session).values({
    userId,
    token,
    expiresAt,
  })

  return { userId, token }
}

/** Helper to create a test edition */
export async function createEdition(ctx: TestContext, id = 'ed-test'): Promise<string> {
  await ctx.db.insert(schema.edition).values({
    id,
    name: 'Test Edition 2026',
    year: 2026,
    startDate: '2026-06-01',
    endDate: '2026-06-03',
    totalBudget: 250000,
    notificationEmail: 'test@atleticageneve.ch',
  })
  return id
}

/** Helper to seed a catalog entry (required before creating events) */
export async function createEventCatalog(
  ctx: TestContext,
  overrides: Partial<typeof schema.eventCatalog.$inferInsert> & { id: string } = { id: 'cat-100m-M' }
): Promise<string> {
  const id = overrides.id
  // Check if already exists to allow re-use
  const existing = await ctx.db.select().from(schema.eventCatalog).where(
    eq(schema.eventCatalog.id, id)
  )
  if (existing.length > 0) return id

  await ctx.db.insert(schema.eventCatalog).values({
    id,
    name: overrides.name ?? '100m',
    discipline: overrides.discipline ?? 'Course',
    gender: overrides.gender ?? 'M',
  })
  return id
}

/** Helper to create a test event (requires edition + event_catalog to exist) */
export async function createEvent(
  ctx: TestContext,
  editionId: string,
  overrides: Partial<typeof schema.event.$inferInsert> & { catalogId?: string } = {}
): Promise<string> {
  const id = overrides.id ?? `evt-${crypto.randomUUID().slice(0, 8)}`
  const catalogId = overrides.catalogId ?? 'cat-100m-M'

  // Ensure catalog entry exists
  await createEventCatalog(ctx, { id: catalogId })

  await ctx.db.insert(schema.event).values({
    id,
    editionId,
    catalogId,
    maxSlots: 8,
    intMinima: 10.2,
    swissMinima: 10.5,
    swissQuota: 1,
    eapQuota: 1,
    ...overrides,
    catalogId, // override any catalogId from overrides with the resolved one
  })
  return id
}

/** Helper to create a test athlete */
export async function createAthlete(
  ctx: TestContext,
  overrides: Partial<typeof schema.athlete.$inferInsert> = {}
): Promise<string> {
  const id = overrides.id ?? `ath-${crypto.randomUUID().slice(0, 8)}`
  await ctx.db.insert(schema.athlete).values({
    id,
    firstName: 'Test',
    lastName: 'Athlete',
    nationality: 'SUI',
    gender: 'M',
    ...overrides,
  })
  return id
}

/** Helper to create a test application */
export async function createApplication(
  ctx: TestContext,
  overrides: Partial<typeof schema.application.$inferInsert> & {
    athleteId: string
    eventId: string
    editionId: string
  }
): Promise<string> {
  const id = overrides.id ?? `app-${crypto.randomUUID().slice(0, 8)}`
  await ctx.db.insert(schema.application).values({
    id,
    participationStatus: 'pending',
    ...overrides,
  })
  return id
}

/** Helper to create a test hotel + room */
export async function createHotelAndRoom(
  ctx: TestContext,
  editionId: string,
  roomOverrides: Partial<typeof schema.hotelRoom.$inferInsert> = {}
): Promise<{ hotelId: string; roomId: string }> {
  const hotelId = `htl-${crypto.randomUUID().slice(0, 8)}`
  const roomId = roomOverrides.id ?? `rm-${crypto.randomUUID().slice(0, 8)}`

  await ctx.db.insert(schema.hotel).values({
    id: hotelId,
    editionId,
    name: 'Test Hotel',
  })

  await ctx.db.insert(schema.hotelRoom).values({
    id: roomId,
    hotelId,
    roomType: 'Single',
    costPerNight: 150,
    dinnerCost: 40,
    reservedRooms: 10,
    ...roomOverrides,
  })

  return { hotelId, roomId }
}
