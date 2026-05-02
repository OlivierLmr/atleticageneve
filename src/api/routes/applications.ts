import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, and, sql, isNull, desc, inArray } from 'drizzle-orm'
import * as schema from '../db/schema'
import { participationStatusChangeSchema, interactionSchema } from '@shared/validation'
import { PARTICIPATION_TRANSITIONS } from '@shared/constants'
import { computeScore } from '@shared/scoring'
import { requireAuth } from '../middleware/auth'
import { perfType, editionWeights } from '../lib/helpers'
import type { Env } from '../index'
import type { ParticipationStatus } from '@shared/types'

const applications = new Hono<Env>()

// All routes require collaborator or committee role
applications.use('*', requireAuth('collaborator', 'committee'))

// ── GET /applications — list applications with filters ───────────────────────

applications.get('/', async (c) => {
  const db = c.get('db')
  const eventId = c.req.query('eventId')
  const negotiationStatus = c.req.query('negotiationStatus')
  const managerId = c.req.query('managerId')
  const search = c.req.query('search')

  // Build conditions
  const conditions = [isNull(schema.athlete.archivedAt)]
  if (eventId) conditions.push(eq(schema.application.eventId, eventId))
  if (negotiationStatus) conditions.push(eq(schema.athlete.negotiationStatus, negotiationStatus))

  // Query applications with athlete, event, and event catalog joins
  const rows = await db
    .select({
      application: schema.application,
      athlete: schema.athlete,
      event: schema.event,
      catalog: schema.eventCatalog,
    })
    .from(schema.application)
    .innerJoin(schema.athlete, eq(schema.application.athleteId, schema.athlete.id))
    .innerJoin(schema.event, eq(schema.application.eventId, schema.event.id))
    .innerJoin(schema.eventCatalog, eq(schema.event.catalogId, schema.eventCatalog.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${schema.application.score} DESC NULLS LAST`)

  // Left join WA performance
  const waPerfs = await db.select().from(schema.waPerformance)
  const waPerfMap = new Map(waPerfs.map(wp => [`${wp.athleteId}-${wp.eventId}`, wp]))

  const baseResults = rows.map((r) => ({
    ...r.application,
    athlete: {
      ...r.athlete,
      negotiationStatus: r.athlete.negotiationStatus,
    },
    event: {
      ...r.event,
      catalog: r.catalog,
    },
    waPerformance: waPerfMap.get(`${r.application.athleteId}-${r.application.eventId}`) ?? null,
  }))

  // Fetch latest agreement totalCost per athlete
  const athleteIds = [...new Set(baseResults.map((r) => r.athlete.id))]
  const latestOfferCostMap = new Map<string, number>()
  if (athleteIds.length > 0) {
    const agreements = await db
      .select({
        athleteId: schema.agreement.athleteId,
        version: schema.agreement.version,
        totalCost: schema.agreement.totalCost,
      })
      .from(schema.agreement)
      .where(inArray(schema.agreement.athleteId, athleteIds))
    const latestVersionMap = new Map<string, number>()
    for (const agr of agreements) {
      const existingVersion = latestVersionMap.get(agr.athleteId) ?? -1
      if (agr.version > existingVersion) {
        latestVersionMap.set(agr.athleteId, agr.version)
        latestOfferCostMap.set(agr.athleteId, agr.totalCost)
      }
    }
  }

  let results = baseResults.map((r) => ({
    ...r,
    latestOfferCost: latestOfferCostMap.get(r.athlete.id) ?? null,
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
      catalog: schema.eventCatalog,
    })
    .from(schema.application)
    .innerJoin(schema.athlete, eq(schema.application.athleteId, schema.athlete.id))
    .innerJoin(schema.event, eq(schema.application.eventId, schema.event.id))
    .innerJoin(schema.eventCatalog, eq(schema.event.catalogId, schema.eventCatalog.id))
    .where(eq(schema.application.id, id))
    .limit(1)

  if (rows.length === 0) {
    return c.json({ error: 'Application not found' }, 404)
  }

  const row = rows[0]

  // Fetch agreements (athlete-level)
  const agreements = await db
    .select()
    .from(schema.agreement)
    .where(eq(schema.agreement.athleteId, row.application.athleteId))
    .orderBy(schema.agreement.version)

  // Fetch interactions (athlete-level, include application-level)
  const interactions = await db
    .select()
    .from(schema.interaction)
    .where(eq(schema.interaction.athleteId, row.application.athleteId))
    .orderBy(sql`${schema.interaction.createdAt} DESC`)

  // Fetch WA performance
  const waPerfs = await db
    .select()
    .from(schema.waPerformance)
    .where(and(
      eq(schema.waPerformance.athleteId, row.application.athleteId),
      eq(schema.waPerformance.eventId, row.application.eventId),
    ))
    .limit(1)

  // Fetch all applications for this athlete (sibling apps) with event+catalog
  const siblingRows = await db
    .select({
      application: schema.application,
      event: schema.event,
      catalog: schema.eventCatalog,
    })
    .from(schema.application)
    .innerJoin(schema.event, eq(schema.application.eventId, schema.event.id))
    .innerJoin(schema.eventCatalog, eq(schema.event.catalogId, schema.eventCatalog.id))
    .where(eq(schema.application.athleteId, row.application.athleteId))

  const siblingApplications = siblingRows.map(s => ({
    ...s.application,
    event: { ...s.event, catalog: s.catalog },
  }))

  return c.json({
    ...row.application,
    athlete: row.athlete,
    event: {
      ...row.event,
      catalog: row.catalog,
    },
    agreements,
    interactions,
    waPerformance: waPerfs[0] ?? null,
    siblingApplications,
  })
})

// ── PATCH /applications/:id/participation-status — change participationStatus ─

applications.patch('/:id/participation-status', zValidator('json', participationStatusChangeSchema), async (c) => {
  const db = c.get('db')
  const user = c.get('user')!
  const id = c.req.param('id')
  const newStatus = c.req.valid('json').participationStatus as ParticipationStatus

  // Get application
  const apps = await db
    .select()
    .from(schema.application)
    .where(eq(schema.application.id, id))
    .limit(1)

  if (apps.length === 0) {
    return c.json({ error: 'Application not found' }, 404)
  }

  const app = apps[0]
  const currentStatus = app.participationStatus as ParticipationStatus

  // Block changes when athlete negotiation is confirmed
  const athletes = await db
    .select({ negotiationStatus: schema.athlete.negotiationStatus })
    .from(schema.athlete)
    .where(eq(schema.athlete.id, app.athleteId))
    .limit(1)

  if (athletes.length > 0 && athletes[0].negotiationStatus === 'confirmed') {
    return c.json({ error: 'Cannot change participation status when athlete negotiation is confirmed' }, 403)
  }

  // Validate transition
  const allowed = PARTICIPATION_TRANSITIONS[currentStatus]
  if (!allowed || !allowed.includes(newStatus)) {
    return c.json({
      error: `Cannot transition participation from "${currentStatus}" to "${newStatus}"`,
      allowedTransitions: allowed,
    }, 400)
  }

  await db
    .update(schema.application)
    .set({ participationStatus: newStatus })
    .where(eq(schema.application.id, id))

  // Log interaction
  await db.insert(schema.interaction).values({
    athleteId: app.athleteId,
    applicationId: id,
    type: 'status_change',
    content: `Participation status changed to "${newStatus}"`,
    authorId: user.id,
    authorName: `${user.firstName} ${user.lastName}`,
  })

  return c.json({ id, participationStatus: newStatus, previousStatus: currentStatus })
})

// ── POST /applications/:id/score — recompute score ───────────────────────────

applications.post('/:id/score', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')

  // Get application with athlete, event, and catalog
  const rows = await db
    .select({
      application: schema.application,
      athlete: schema.athlete,
      event: schema.event,
      catalog: schema.eventCatalog,
    })
    .from(schema.application)
    .innerJoin(schema.athlete, eq(schema.application.athleteId, schema.athlete.id))
    .innerJoin(schema.event, eq(schema.application.eventId, schema.event.id))
    .innerJoin(schema.eventCatalog, eq(schema.event.catalogId, schema.eventCatalog.id))
    .where(eq(schema.application.id, id))
    .limit(1)

  if (rows.length === 0) {
    return c.json({ error: 'Application not found' }, 404)
  }

  const { application: app, athlete: ath, event: evt, catalog } = rows[0]

  // Read PB/SB from wa_performance
  const waPerfs = await db
    .select()
    .from(schema.waPerformance)
    .where(and(
      eq(schema.waPerformance.athleteId, app.athleteId),
      eq(schema.waPerformance.eventId, app.eventId),
    ))
    .limit(1)

  const waPerf = waPerfs[0]
  if (!waPerf || waPerf.personalBest == null) {
    // No WA data — score pending
    await db
      .update(schema.application)
      .set({ score: null, recommendation: 'Pending' })
      .where(eq(schema.application.id, id))

    return c.json({ id, score: null, recommendation: 'Pending' })
  }

  // Get edition for weights
  const editions = await db.select().from(schema.edition).limit(1)
  const edition = editions[0]
  const weights = edition ? editionWeights(edition) : undefined

  // Use agreement totalCost if negotiation has started, else use estTotal
  const latestAgreements = await db
    .select()
    .from(schema.agreement)
    .where(eq(schema.agreement.athleteId, app.athleteId))
    .orderBy(desc(schema.agreement.version))
    .limit(1)
  const effectiveCost = latestAgreements.length > 0 ? latestAgreements[0].totalCost : (ath.estTotal ?? 0)

  const scoreResult = computeScore({
    personalBest: waPerf.personalBest ?? 0,
    seasonBest: waPerf.seasonBest ?? 0,
    worldRanking: waPerf.worldRanking ?? 100,
    estimatedCostTotal: effectiveCost,
    isEap: ath.isEap,
    isSwiss: ath.isSwiss,
    perfType: perfType(catalog.discipline),
    intMinima: evt.intMinima,
    swissMinima: evt.swissMinima,
    eapMinima: evt.eapMinima,
  }, weights)

  await db
    .update(schema.application)
    .set({
      score: scoreResult.finalScore,
      recommendation: scoreResult.recommendation,
    })
    .where(eq(schema.application.id, id))

  return c.json({
    id,
    score: scoreResult.finalScore,
    recommendation: scoreResult.recommendation,
    breakdown: scoreResult,
  })
})

// ── POST /applications/:id/interactions — add an interaction ─────────────────

applications.post('/:id/interactions', zValidator('json', interactionSchema), async (c) => {
  const db = c.get('db')
  const user = c.get('user')!
  const id = c.req.param('id')
  const { type, content } = c.req.valid('json')

  // Verify application exists and get athleteId
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
    athleteId: apps[0].athleteId,
    applicationId: id,
    type,
    content,
    authorId: user.id,
    authorName: `${user.firstName} ${user.lastName}`,
  })

  return c.json({ id: interactionId }, 201)
})

export default applications
