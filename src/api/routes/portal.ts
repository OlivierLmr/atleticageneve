import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import * as schema from '../db/schema'
import { contractOfferSchema, statusChangeSchema } from '@shared/validation'
import { VALID_TRANSITIONS, HOTEL_COST_PER_NIGHT } from '@shared/constants'
import { requireAuth } from '../middleware/auth'
import { sendEmail, sendStatusChangeEmail } from '../services/email'
import type { Env } from '../index'
import type { ApplicationStatus } from '@shared/types'

const portal = new Hono<Env>()

// ── Athlete portal ───────────────────────────────────────────────────────────

// GET /portal/athlete — get current athlete's applications
portal.get('/athlete', requireAuth('athlete', 'manager'), async (c) => {
  const db = c.get('db')
  const user = c.get('user')!

  // Find athlete records linked to this user
  const athletes = await db
    .select()
    .from(schema.athlete)
    .where(eq(schema.athlete.userId, user.id))

  if (athletes.length === 0) {
    return c.json({ applications: [] })
  }

  const results = []
  for (const ath of athletes) {
    const appRows = await db
      .select()
      .from(schema.application)
      .where(eq(schema.application.athleteId, ath.id))

    for (const app of appRows) {
      const eventRows = await db
        .select()
        .from(schema.event)
        .where(eq(schema.event.id, app.eventId))
        .limit(1)

      const contracts = await db
        .select()
        .from(schema.contractOffer)
        .where(eq(schema.contractOffer.applicationId, app.id))
        .orderBy(schema.contractOffer.version)

      results.push({
        ...app,
        athlete: ath,
        event: eventRows[0] ?? null,
        contracts,
      })
    }
  }

  return c.json({ applications: results })
})

// POST /portal/athlete/:appId/respond — accept, reject, or counter-offer
portal.post('/athlete/:appId/respond', requireAuth('athlete', 'manager'), async (c) => {
  const db = c.get('db')
  const user = c.get('user')!
  const appId = c.req.param('appId')!
  const body = await c.req.json()
  const action = body.action as string // 'accept' | 'reject' | 'counter_offer' | 'withdraw'

  // Get the application
  const appRows = await db
    .select()
    .from(schema.application)
    .where(eq(schema.application.id, appId))
    .limit(1)

  if (appRows.length === 0) {
    return c.json({ error: 'Application not found' }, 404)
  }
  const app = appRows[0]

  const athRows = await db
    .select()
    .from(schema.athlete)
    .where(eq(schema.athlete.id, app.athleteId))
    .limit(1)

  if (athRows.length === 0) {
    return c.json({ error: 'Athlete not found' }, 404)
  }
  const ath = athRows[0]

  // Verify athlete belongs to this user (either directly or via manager)
  if (ath.userId !== user.id && ath.managerId !== user.id) {
    return c.json({ error: 'Not authorized to act on this application' }, 403)
  }

  const currentStatus = app.status as ApplicationStatus

  // Map action to target status
  const actionMap: Record<string, ApplicationStatus> = {
    accept: 'accepted',
    reject: 'rejected',
    withdraw: 'withdrawn',
    counter_offer: 'counter_offer',
  }

  const targetStatus = actionMap[action]
  if (!targetStatus) {
    return c.json({ error: `Invalid action: ${action}` }, 400)
  }

  // Validate transition
  const allowed = VALID_TRANSITIONS[currentStatus]
  if (!allowed?.includes(targetStatus)) {
    return c.json({
      error: `Cannot ${action} from "${currentStatus}" status`,
      allowedTransitions: allowed,
    }, 400)
  }

  const now = new Date().toISOString()

  // If counter-offer, create a contract offer from athlete
  if (action === 'counter_offer') {
    const parsed = contractOfferSchema.safeParse(body.offer)
    if (!parsed.success) {
      return c.json({ error: 'Invalid counter-offer data', details: parsed.error.flatten() }, 400)
    }
    const offer = parsed.data

    // Get next version
    const existing = await db
      .select({ version: schema.contractOffer.version })
      .from(schema.contractOffer)
      .where(eq(schema.contractOffer.applicationId, appId))
      .orderBy(desc(schema.contractOffer.version))
      .limit(1)

    const nextVersion = existing.length > 0 ? existing[0].version + 1 : 1

    const nights = [
      offer.hotelNightTue, offer.hotelNightWed, offer.hotelNightThu,
      offer.hotelNightFri, offer.hotelNightSat, offer.hotelNightSun,
    ].filter(Boolean).length

    const totalCost = offer.bonus + offer.otherCompensation + offer.transport +
      offer.catering + nights * HOTEL_COST_PER_NIGHT

    await db.insert(schema.contractOffer).values({
      applicationId: appId,
      version: nextVersion,
      direction: 'to_organizer',
      bonus: offer.bonus,
      otherCompensation: offer.otherCompensation,
      transport: offer.transport,
      localTransport: offer.localTransport,
      hotelNightTue: offer.hotelNightTue,
      hotelNightWed: offer.hotelNightWed,
      hotelNightThu: offer.hotelNightThu,
      hotelNightFri: offer.hotelNightFri,
      hotelNightSat: offer.hotelNightSat,
      hotelNightSun: offer.hotelNightSun,
      catering: offer.catering,
      notes: offer.notes ?? null,
      totalCost,
      sentBy: user.id,
      sentAt: now,
    })

    // Log interaction
    await db.insert(schema.interaction).values({
      applicationId: appId,
      type: 'counter_offer',
      content: `Counter-offer v${nextVersion} submitted — CHF ${totalCost.toLocaleString()}`,
      authorId: user.id,
      authorName: `${user.firstName} ${user.lastName}`,
    })
  }

  // Update status
  const updates: Record<string, unknown> = { status: targetStatus, updatedAt: now }
  if (['accepted', 'rejected', 'withdrawn'].includes(targetStatus)) {
    updates.decidedAt = now
  }

  await db
    .update(schema.application)
    .set(updates)
    .where(eq(schema.application.id, appId))

  // Log status change interaction (unless counter_offer already logged)
  if (action !== 'counter_offer') {
    await db.insert(schema.interaction).values({
      applicationId: appId,
      type: 'status_change',
      content: `Application ${action}ed by ${user.firstName} ${user.lastName}`,
      authorId: user.id,
      authorName: `${user.firstName} ${user.lastName}`,
    })
  }

  // Notify collaborators via email stub
  sendEmail({
    to: 'collaborators@atleticageneve.ch',
    subject: `Application update — ${ath.firstName} ${ath.lastName}`,
    body: `${ath.firstName} ${ath.lastName} has ${action}ed the offer.\nNew status: ${targetStatus}`,
  })

  return c.json({ id: appId, status: targetStatus, previousStatus: currentStatus })
})

// ── Manager portal ───────────────────────────────────────────────────────────

// GET /portal/manager — get all athletes managed by current user
portal.get('/manager', requireAuth('manager'), async (c) => {
  const db = c.get('db')
  const user = c.get('user')!

  const athletes = await db
    .select()
    .from(schema.athlete)
    .where(eq(schema.athlete.managerId, user.id))

  const results = []
  for (const ath of athletes) {
    const appRows = await db
      .select()
      .from(schema.application)
      .where(eq(schema.application.athleteId, ath.id))

    for (const app of appRows) {
      const eventRows = await db
        .select()
        .from(schema.event)
        .where(eq(schema.event.id, app.eventId))
        .limit(1)

      const contracts = await db
        .select()
        .from(schema.contractOffer)
        .where(eq(schema.contractOffer.applicationId, app.id))
        .orderBy(schema.contractOffer.version)

      results.push({
        ...app,
        athlete: ath,
        event: eventRows[0] ?? null,
        contracts,
        latestContract: contracts.length > 0 ? contracts[contracts.length - 1] : null,
      })
    }
  }

  // KPI summary
  const total = results.length
  const toReview = results.filter((r) => r.status === 'to_review').length
  const inNegotiation = results.filter((r) =>
    ['contract_sent', 'counter_offer'].includes(r.status)
  ).length
  const confirmed = results.filter((r) => r.status === 'accepted').length
  const rejected = results.filter((r) => r.status === 'rejected').length

  return c.json({
    applications: results,
    kpi: { total, toReview, inNegotiation, confirmed, rejected },
  })
})

export default portal
