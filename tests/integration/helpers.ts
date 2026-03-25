/**
 * Integration test helpers — creates a Miniflare instance with a fresh D1 database
 * and provides the Hono app bound to it.
 */
import { Miniflare } from 'miniflare'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '@api/db/schema'
import app from '@api/index'
import fs from 'fs'
import path from 'path'

const MIGRATION_PATH = path.resolve(__dirname, '../../src/api/db/migrations/0001_initial.sql')

export interface TestContext {
  mf: Miniflare
  db: ReturnType<typeof drizzle<typeof schema>>
  d1: D1Database
  request: (path: string, init?: RequestInit) => Promise<Response>
}

export async function setupTestContext(): Promise<TestContext> {
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok") } }',
    d1Databases: { DB: 'test-db' },
  })

  const d1 = await mf.getD1Database('DB') as unknown as D1Database
  const db = drizzle(d1, { schema })

  // Run migration — use batch with prepared statements
  const migrationSql = fs.readFileSync(MIGRATION_PATH, 'utf-8')
  // Split on semicolons followed by newline (to avoid splitting inside CHECK constraints)
  // then strip comments
  const statements = migrationSql
    .split(/;\s*\n/)
    .map((s) => s.replace(/--.*$/gm, '').trim())
    .filter((s) => s.length > 0)

  const batch = statements.map((s) => d1.prepare(s))
  await d1.batch(batch)

  // Request helper — runs directly against the Hono app with a mocked env
  const request = async (urlPath: string, init?: RequestInit): Promise<Response> => {
    const url = `http://localhost${urlPath}`
    const req = new Request(url, init)
    // Build the env and executionCtx that Hono expects
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
  })
  return id
}

/** Helper to create a test event */
export async function createEvent(
  ctx: TestContext,
  editionId: string,
  overrides: Partial<typeof schema.event.$inferInsert> = {}
): Promise<string> {
  const id = overrides.id ?? `evt-${crypto.randomUUID().slice(0, 8)}`
  await ctx.db.insert(schema.event).values({
    id,
    editionId,
    name: '100m Men',
    discipline: '100m',
    gender: 'M',
    perfType: 'MIN',
    maxSlots: 8,
    intMinima: 10.2,
    swissMinima: 10.5,
    swissQuota: 1,
    eapQuota: 1,
    ...overrides,
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
    status: 'to_review',
    ...overrides,
  })
  return id
}
