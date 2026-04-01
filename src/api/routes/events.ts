import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, and } from 'drizzle-orm'
import * as schema from '../db/schema'
import { eventCreateSchema, eventUpdateSchema } from '@shared/validation'
import { requireAuth } from '../middleware/auth'
import type { Env } from '../index'
import type { PerfType } from '@shared/types'

const events = new Hono<Env>()

// ── GET /events — list all events for current edition ────────────────────────

events.get('/', async (c) => {
  const db = c.get('db')
  const gender = c.req.query('gender')

  // Join with event_catalog for name, discipline, gender
  const results = await db
    .select({
      event: schema.event,
      catalog: schema.eventCatalog,
    })
    .from(schema.event)
    .innerJoin(schema.eventCatalog, eq(schema.event.catalogId, schema.eventCatalog.id))

  let filtered = results
  if (gender && (gender === 'M' || gender === 'F')) {
    filtered = results.filter(r => r.catalog.gender === gender)
  }

  return c.json(filtered.map(r => {
    const perfType: PerfType = r.catalog.discipline === 'Course' ? 'MIN' : 'MAX'
    return {
      ...r.event,
      name: r.catalog.name,
      discipline: r.catalog.discipline,
      gender: r.catalog.gender,
      perfType,
    }
  }))
})

// ── GET /events/:id — event detail ───────────────────────────────────────────

events.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')

  const results = await db
    .select({
      event: schema.event,
      catalog: schema.eventCatalog,
    })
    .from(schema.event)
    .innerJoin(schema.eventCatalog, eq(schema.event.catalogId, schema.eventCatalog.id))
    .where(eq(schema.event.id, id))
    .limit(1)

  if (results.length === 0) {
    return c.json({ error: 'Event not found' }, 404)
  }

  const r = results[0]
  const perfType: PerfType = r.catalog.discipline === 'Course' ? 'MIN' : 'MAX'

  return c.json({
    ...r.event,
    name: r.catalog.name,
    discipline: r.catalog.discipline,
    gender: r.catalog.gender,
    perfType,
  })
})

// ── GET /events/:id/confirmed-athletes — confirmed athletes for event ────────

events.get('/:id/confirmed-athletes', async (c) => {
  const db = c.get('db')
  const eventId = c.req.param('id')

  // Athletes with negotiationStatus='confirmed' AND application participationStatus='selected'
  const apps = await db
    .select({
      application: schema.application,
      athlete: schema.athlete,
    })
    .from(schema.application)
    .innerJoin(schema.athlete, eq(schema.application.athleteId, schema.athlete.id))
    .where(and(
      eq(schema.application.eventId, eventId),
      eq(schema.application.participationStatus, 'selected'),
      eq(schema.athlete.negotiationStatus, 'confirmed'),
    ))

  const results = apps.map(r => ({
    athleteId: r.athlete.id,
    firstName: r.athlete.firstName,
    lastName: r.athlete.lastName,
    nationality: r.athlete.nationality,
    gender: r.athlete.gender,
    participationStatus: r.application.participationStatus,
    personalBest: r.application.personalBest,
    seasonBest: r.application.seasonBest,
    worldRanking: r.application.worldRanking,
  }))

  return c.json(results)
})

// ── POST /events — create event (committee only) ────────────────────────────

events.post('/', requireAuth('committee'), zValidator('json', eventCreateSchema), async (c) => {
  const data = c.req.valid('json')
  const db = c.get('db')

  // Get current edition
  const editions = await db.select().from(schema.edition).limit(1)
  if (editions.length === 0) {
    return c.json({ error: 'No edition configured' }, 400)
  }
  const edition = editions[0]

  // Generate ID from catalogId + edition year
  const id = `${data.catalogId}-${edition.year}`

  await db.insert(schema.event).values({
    id,
    editionId: edition.id,
    catalogId: data.catalogId,
    maxSlots: data.maxSlots,
    intMinima: data.intMinima,
    swissMinima: data.swissMinima,
    eapMinima: data.eapMinima ?? null,
    meetRecord: data.meetRecord ?? null,
    targetPerf: data.targetPerf ?? null,
    swissQuota: data.swissQuota ?? 1,
    eapQuota: data.eapQuota ?? 1,
    prizeMoney1st: data.prizeMoney1st ?? 0,
    prizeMoney2nd: data.prizeMoney2nd ?? 0,
    prizeMoney3rd: data.prizeMoney3rd ?? 0,
    prizeMoney4th: data.prizeMoney4th ?? 0,
    prizeMoney5th: data.prizeMoney5th ?? 0,
    prizeMoney6th: data.prizeMoney6th ?? 0,
    prizeMoney7th: data.prizeMoney7th ?? 0,
    prizeMoney8th: data.prizeMoney8th ?? 0,
  })

  return c.json({ id }, 201)
})

// ── PATCH /events/:id — update event (committee only) ───────────────────────

events.patch('/:id', requireAuth('committee'), zValidator('json', eventUpdateSchema), async (c) => {
  const id = c.req.param('id')
  const data = c.req.valid('json')
  const db = c.get('db')

  const existing = await db.select().from(schema.event).where(eq(schema.event.id, id)).limit(1)
  if (existing.length === 0) {
    return c.json({ error: 'Event not found' }, 404)
  }

  await db.update(schema.event).set(data).where(eq(schema.event.id, id))

  return c.json({ id })
})

export default events
