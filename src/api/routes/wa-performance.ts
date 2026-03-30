import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import * as schema from '../db/schema'
import { requireAuth } from '../middleware/auth'
import type { Env } from '../index'

const waPerformance = new Hono<Env>()

waPerformance.use('*', requireAuth('collaborator', 'committee'))

// ── GET /wa-performance?athleteId=X — list performances for an athlete ───────

waPerformance.get('/', async (c) => {
  const db = c.get('db')
  const athleteId = c.req.query('athleteId')

  if (!athleteId) {
    return c.json({ error: 'athleteId query parameter is required' }, 400)
  }

  const results = await db
    .select({
      performance: schema.waPerformance,
      event: schema.event,
    })
    .from(schema.waPerformance)
    .innerJoin(schema.event, eq(schema.waPerformance.eventId, schema.event.id))
    .where(eq(schema.waPerformance.athleteId, athleteId))

  return c.json(results.map(r => ({
    ...r.performance,
    event: { id: r.event.id, name: r.event.name, discipline: r.event.discipline, gender: r.event.gender },
  })))
})

// ── POST /wa-performance — upsert PB/SB/ranking for athlete+event ────────────

waPerformance.post('/', async (c) => {
  const db = c.get('db')
  const body = await c.req.json()

  const { athleteId, eventId, personalBest, personalBestVal, seasonBest, seasonBestVal, worldRanking } = body

  if (!athleteId || !eventId) {
    return c.json({ error: 'athleteId and eventId are required' }, 400)
  }

  // Check if record exists
  const existing = await db
    .select()
    .from(schema.waPerformance)
    .where(and(
      eq(schema.waPerformance.athleteId, athleteId),
      eq(schema.waPerformance.eventId, eventId),
    ))
    .limit(1)

  const now = new Date().toISOString()

  if (existing.length > 0) {
    await db
      .update(schema.waPerformance)
      .set({
        personalBest: personalBest ?? existing[0].personalBest,
        personalBestVal: personalBestVal ?? existing[0].personalBestVal,
        seasonBest: seasonBest ?? existing[0].seasonBest,
        seasonBestVal: seasonBestVal ?? existing[0].seasonBestVal,
        worldRanking: worldRanking ?? existing[0].worldRanking,
        updatedAt: now,
      })
      .where(eq(schema.waPerformance.id, existing[0].id))

    return c.json({ id: existing[0].id, updated: true })
  }

  const id = crypto.randomUUID()
  await db.insert(schema.waPerformance).values({
    id,
    athleteId,
    eventId,
    personalBest: personalBest ?? null,
    personalBestVal: personalBestVal ?? null,
    seasonBest: seasonBest ?? null,
    seasonBestVal: seasonBestVal ?? null,
    worldRanking: worldRanking ?? null,
  })

  return c.json({ id, updated: false }, 201)
})

export default waPerformance
