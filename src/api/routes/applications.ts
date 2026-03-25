import { Hono } from 'hono'
import { eq, and, sql } from 'drizzle-orm'
import * as schema from '../db/schema'
import { statusChangeSchema } from '@shared/validation'
import { VALID_TRANSITIONS } from '@shared/constants'
import { computeScore, parsePerf } from '@shared/scoring'
import { requireAuth } from '../middleware/auth'
import { sendStatusChangeEmail } from '../services/email'
import type { Env } from '../index'
import type { ApplicationStatus } from '@shared/types'

const applications = new Hono<Env>()

// All routes require collaborator or committee role
applications.use('*', requireAuth('collaborator', 'committee'))

// ── GET /applications — list applications with filters ───────────────────────

applications.get('/', async (c) => {
  const db = c.get('db')
  const eventId = c.req.query('eventId')
  const status = c.req.query('status')
  const managerId = c.req.query('managerId')
  const search = c.req.query('search')

  // Build conditions
  const conditions = []
  if (eventId) conditions.push(eq(schema.application.eventId, eventId))
  if (status) conditions.push(eq(schema.application.status, status))

  // Query applications with athlete and event joins
  const rows = await db
    .select({
      application: schema.application,
      athlete: schema.athlete,
      event: schema.event,
    })
    .from(schema.application)
    .innerJoin(schema.athlete, eq(schema.application.athleteId, schema.athlete.id))
    .innerJoin(schema.event, eq(schema.application.eventId, schema.event.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${schema.application.score} DESC NULLS LAST`)

  let results = rows.map((r) => ({
    ...r.application,
    athlete: r.athlete,
    event: r.event,
  }))

  // Filter by managerId (athlete.managerId)
  if (managerId) {
    results = results.filter((r) => r.athlete.managerId === managerId)
  }

  // Filter by search (athlete name)
  if (search) {
    const q = search.toLowerCase()
    results = results.filter(
      (r) =>
        r.athlete.firstName.toLowerCase().includes(q) ||
        r.athlete.lastName.toLowerCase().includes(q)
    )
  }

  return c.json(results)
})

// ── GET /applications/:id — full application detail ──────────────────────────

applications.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')

  const rows = await db
    .select({
      application: schema.application,
      athlete: schema.athlete,
      event: schema.event,
    })
    .from(schema.application)
    .innerJoin(schema.athlete, eq(schema.application.athleteId, schema.athlete.id))
    .innerJoin(schema.event, eq(schema.application.eventId, schema.event.id))
    .where(eq(schema.application.id, id))
    .limit(1)

  if (rows.length === 0) {
    return c.json({ error: 'Application not found' }, 404)
  }

  const row = rows[0]

  // Fetch contracts
  const contracts = await db
    .select()
    .from(schema.contractOffer)
    .where(eq(schema.contractOffer.applicationId, id))
    .orderBy(schema.contractOffer.version)

  // Fetch interactions
  const interactions = await db
    .select()
    .from(schema.interaction)
    .where(eq(schema.interaction.applicationId, id))
    .orderBy(sql`${schema.interaction.createdAt} DESC`)

  return c.json({
    ...row.application,
    athlete: row.athlete,
    event: row.event,
    contracts,
    interactions,
  })
})

// ── PATCH /applications/:id/status — transition application status ───────────

applications.patch('/:id/status', async (c) => {
  const db = c.get('db')
  const user = c.get('user')!
  const id = c.req.param('id')

  // Parse body
  const body = await c.req.json()
  const parsed = statusChangeSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid status', details: parsed.error.flatten() }, 400)
  }
  const newStatus = parsed.data.status as ApplicationStatus

  // Get current application
  const apps = await db
    .select()
    .from(schema.application)
    .where(eq(schema.application.id, id))
    .limit(1)

  if (apps.length === 0) {
    return c.json({ error: 'Application not found' }, 404)
  }

  const app = apps[0]
  const currentStatus = app.status as ApplicationStatus

  // Validate transition
  const allowed = VALID_TRANSITIONS[currentStatus]
  if (!allowed || !allowed.includes(newStatus)) {
    return c.json({
      error: `Cannot transition from "${currentStatus}" to "${newStatus}"`,
      allowedTransitions: allowed,
    }, 400)
  }

  // Update status
  const now = new Date().toISOString()
  const updates: Record<string, unknown> = {
    status: newStatus,
    updatedAt: now,
  }
  if (['accepted', 'rejected', 'withdrawn'].includes(newStatus)) {
    updates.decidedAt = now
  }

  await db
    .update(schema.application)
    .set(updates)
    .where(eq(schema.application.id, id))

  // Log interaction
  await db.insert(schema.interaction).values({
    applicationId: id,
    type: 'status_change',
    content: `Status changed from "${currentStatus}" to "${newStatus}"`,
    authorId: user.id,
    authorName: `${user.firstName} ${user.lastName}`,
  })

  // Send email notification
  const athletes = await db
    .select()
    .from(schema.athlete)
    .where(eq(schema.athlete.id, app.athleteId))
    .limit(1)

  if (athletes.length > 0) {
    const ath = athletes[0]
    const email = ath.athleteEmail || ath.managerId ? undefined : undefined
    // Try to notify athlete or their manager
    if (ath.athleteEmail) {
      sendStatusChangeEmail(
        ath.athleteEmail,
        `${ath.firstName} ${ath.lastName}`,
        newStatus,
        'http://localhost:5173/athlete/portal'
      )
    }
    if (ath.managerId) {
      const managers = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, ath.managerId))
        .limit(1)
      if (managers.length > 0 && managers[0].email) {
        sendStatusChangeEmail(
          managers[0].email,
          `${ath.firstName} ${ath.lastName}`,
          newStatus,
          'http://localhost:5173/manager/portal'
        )
      }
    }
  }

  return c.json({ id, status: newStatus, previousStatus: currentStatus })
})

// ── POST /applications/:id/score — re-compute score ──────────────────────────

applications.post('/:id/score', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')

  // Get application with event
  const rows = await db
    .select({
      application: schema.application,
      athlete: schema.athlete,
      event: schema.event,
    })
    .from(schema.application)
    .innerJoin(schema.athlete, eq(schema.application.athleteId, schema.athlete.id))
    .innerJoin(schema.event, eq(schema.application.eventId, schema.event.id))
    .where(eq(schema.application.id, id))
    .limit(1)

  if (rows.length === 0) {
    return c.json({ error: 'Application not found' }, 404)
  }

  const { application: app, athlete: ath, event: evt } = rows[0]

  const scoreResult = computeScore({
    eventId: app.eventId,
    personalBest: app.personalBest ?? '0',
    seasonBest: app.seasonBest ?? '0',
    swissMinima: String(evt.swissMinima),
    worldRanking: app.worldRanking ?? 100,
    estimatedCostTotal: app.estTotal ?? 0,
    isEap: ath.isEap,
  })

  await db
    .update(schema.application)
    .set({
      score: scoreResult.finalScore,
      recommendation: scoreResult.recommendation,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.application.id, id))

  return c.json({
    id,
    score: scoreResult.finalScore,
    recommendation: scoreResult.recommendation,
    breakdown: scoreResult,
  })
})

// ── PATCH /applications/:id — update application fields (internal notes, logistics, etc.) ──

applications.patch('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const body = await c.req.json()

  // Only allow certain fields to be updated
  const allowedFields = [
    'internalNotes', 'assignedSelector',
    'hotelId', 'roomNumber', 'accommodationReqs',
    'arrivalDate', 'arrivalFlight', 'arrivalFrom', 'arrivalTime',
    'departureDate', 'departureFlight', 'departureTo', 'departureTime',
    'estTravel', 'estAccommodation', 'estAppearance', 'estTotal',
  ]

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field]
    }
  }

  // Recalculate estTotal if cost fields changed
  if ('estTravel' in body || 'estAccommodation' in body || 'estAppearance' in body) {
    const apps = await db.select().from(schema.application).where(eq(schema.application.id, id)).limit(1)
    if (apps.length > 0) {
      const current = apps[0]
      const travel = (body.estTravel ?? current.estTravel) || 0
      const accommodation = (body.estAccommodation ?? current.estAccommodation) || 0
      const appearance = (body.estAppearance ?? current.estAppearance) || 0
      updates.estTotal = travel + accommodation + appearance
    }
  }

  await db
    .update(schema.application)
    .set(updates)
    .where(eq(schema.application.id, id))

  return c.json({ id, updated: Object.keys(updates) })
})

// ── POST /applications/:id/interactions — add an interaction ─────────────────

applications.post('/:id/interactions', async (c) => {
  const db = c.get('db')
  const user = c.get('user')!
  const id = c.req.param('id')
  const body = await c.req.json()

  const type = body.type
  const content = body.content

  if (!type || !content) {
    return c.json({ error: 'type and content are required' }, 400)
  }

  const validTypes = ['email', 'call', 'note']
  if (!validTypes.includes(type)) {
    return c.json({ error: `type must be one of: ${validTypes.join(', ')}` }, 400)
  }

  // Verify application exists
  const apps = await db
    .select()
    .from(schema.application)
    .where(eq(schema.application.id, id))
    .limit(1)

  if (apps.length === 0) {
    return c.json({ error: 'Application not found' }, 404)
  }

  const interactionId = crypto.randomUUID()
  await db.insert(schema.interaction).values({
    id: interactionId,
    applicationId: id,
    type,
    content,
    authorId: user.id,
    authorName: `${user.firstName} ${user.lastName}`,
  })

  return c.json({ id: interactionId }, 201)
})

export default applications
