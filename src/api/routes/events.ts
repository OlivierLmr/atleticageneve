import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, and } from 'drizzle-orm'
import * as schema from '../db/schema'
import { eventConfigSchema } from '@shared/validation'
import { requireAuth } from '../middleware/auth'
import type { Env } from '../index'

const events = new Hono<Env>()

// ── GET /events — list all events for current edition (optional gender filter) ─

events.get('/', async (c) => {
  const db = c.get('db')
  const gender = c.req.query('gender')

  let query = db.select().from(schema.event)
  if (gender && (gender === 'M' || gender === 'F')) {
    const results = await db.select().from(schema.event).where(eq(schema.event.gender, gender))
    return c.json(results)
  }

  const results = await query
  return c.json(results)
})

// ── GET /events/:id — get event detail ────────────────────────────────────────

events.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')

  const results = await db.select().from(schema.event).where(eq(schema.event.id, id)).limit(1)
  if (results.length === 0) {
    return c.json({ error: 'Event not found' }, 404)
  }

  return c.json(results[0])
})

// ── GET /events/:id/confirmed-athletes — athletes accepted + selected ─────────

events.get('/:id/confirmed-athletes', async (c) => {
  const db = c.get('db')
  const eventId = c.req.param('id')

  // Find applications for this event where participation_status = 'selected'
  // AND athlete.negotiation_status = 'accepted'
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
      eq(schema.athlete.negotiationStatus, 'accepted'),
    ))

  const results = apps.map(r => ({
    athleteId: r.athlete.id,
    firstName: r.athlete.firstName,
    lastName: r.athlete.lastName,
    nationality: r.athlete.nationality,
    gender: r.athlete.gender,
    participationStatus: r.application.participationStatus,
  }))

  return c.json(results)
})

// ── POST /events — create a new event (committee only) ────────────────────────

events.post('/', requireAuth('committee'), zValidator('json', eventConfigSchema), async (c) => {
  const data = c.req.valid('json')
  const db = c.get('db')

  // Get current edition
  const editions = await db.select().from(schema.edition).limit(1)
  if (editions.length === 0) {
    return c.json({ error: 'No edition configured' }, 400)
  }

  const id = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')

  await db.insert(schema.event).values({
    id,
    editionId: editions[0].id,
    name: data.name,
    discipline: data.discipline,
    gender: data.gender,
    perfType: data.perfType,
    maxSlots: data.maxSlots,
    intMinima: data.intMinima,
    swissMinima: data.swissMinima,
    eapMinima: data.eapMinima ?? null,
    meetRecord: data.meetRecord ?? null,
    targetPerf: data.targetPerf ?? null,
    swissQuota: data.swissQuota,
    eapQuota: data.eapQuota,
    prize1st: data.prize1st,
    prize2nd: data.prize2nd,
    prize3rd: data.prize3rd,
  })

  return c.json({ id }, 201)
})

// ── PATCH /events/:id — update event config (committee only) ──────────────────

events.patch('/:id', requireAuth('committee'), zValidator('json', eventConfigSchema.partial()), async (c) => {
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
