import { Hono } from 'hono'
import { eq, or, desc } from 'drizzle-orm'
import * as schema from '../db/schema'
import { contractOfferSchema } from '@shared/validation'
import { NEGOTIATION_TRANSITIONS } from '@shared/constants'
import { calculateTotalCost } from './contracts'
import { requireAuth } from '../middleware/auth'
import { sendEmail } from '../services/email'
import type { Env } from '../index'
import type { NegotiationStatus } from '@shared/types'

const portal = new Hono<Env>()

// ── Athlete portal ───────────────────────────────────────────────────────────

// GET /portal/athlete — get current athlete's data (grouped by athlete)
portal.get('/athlete', requireAuth('athlete', 'manager'), async (c) => {
  const db = c.get('db')
  const user = c.get('user')!

  // Find athlete records linked to this user (by userId or managerId)
  const athletes = await db
    .select()
    .from(schema.athlete)
    .where(or(eq(schema.athlete.userId, user.id), eq(schema.athlete.managerId, user.id)))

  if (athletes.length === 0) {
    return c.json({ athletes: [] })
  }

  const results = []
  for (const ath of athletes) {
    const appRows = await db
      .select()
      .from(schema.application)
      .where(eq(schema.application.athleteId, ath.id))

    const applications = []
    for (const app of appRows) {
      const eventRows = await db
        .select()
        .from(schema.event)
        .where(eq(schema.event.id, app.eventId))
        .limit(1)

      applications.push({
        ...app,
        event: eventRows[0] ?? null,
      })
    }

    // Contracts at athlete level
    const contracts = await db
      .select()
      .from(schema.contractOffer)
      .where(eq(schema.contractOffer.athleteId, ath.id))
      .orderBy(schema.contractOffer.version)

    // Strip cost info from contracts for athletes/managers
    const sanitizedContracts = contracts.map(co => ({
      ...co,
      totalCost: undefined, // hidden from athlete/manager
    }))

    results.push({
      ...ath,
      applications,
      contracts: sanitizedContracts,
      latestContract: sanitizedContracts.length > 0 ? sanitizedContracts[sanitizedContracts.length - 1] : null,
    })
  }

  return c.json({ athletes: results })
})

// POST /portal/athlete/:athleteId/respond — accept, reject, or counter-offer
portal.post('/athlete/:athleteId/respond', requireAuth('athlete', 'manager'), async (c) => {
  const db = c.get('db')
  const user = c.get('user')!
  const athleteId = c.req.param('athleteId')!
  const body = await c.req.json()
  const action = body.action as string // 'accept' | 'reject' | 'counter_offer' | 'withdraw'

  // Get the athlete
  const athRows = await db
    .select()
    .from(schema.athlete)
    .where(eq(schema.athlete.id, athleteId))
    .limit(1)

  if (athRows.length === 0) {
    return c.json({ error: 'Athlete not found' }, 404)
  }
  const ath = athRows[0]

  // Verify athlete belongs to this user (either directly or via manager)
  if (ath.userId !== user.id && ath.managerId !== user.id) {
    return c.json({ error: 'Not authorized to act on this athlete' }, 403)
  }

  const currentStatus = ath.negotiationStatus as NegotiationStatus

  // Map action to target status
  const actionMap: Record<string, NegotiationStatus> = {
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
  const allowed = NEGOTIATION_TRANSITIONS[currentStatus]
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
      .where(eq(schema.contractOffer.athleteId, athleteId))
      .orderBy(desc(schema.contractOffer.version))
      .limit(1)

    const nextVersion = existing.length > 0 ? existing[0].version + 1 : 1

    // Get edition costs for total calculation
    const editions = await db.select().from(schema.edition).limit(1)
    const edition = editions[0]

    let hotelCostPerNight = 0
    if (offer.hotelId) {
      const hotels = await db.select().from(schema.hotel).where(eq(schema.hotel.id, offer.hotelId)).limit(1)
      if (hotels.length > 0) hotelCostPerNight = hotels[0].costPerNight
    }

    const totalCost = calculateTotalCost(offer, {
      hotelCostPerNight,
      dinnerCostPp: edition.dinnerCostPp,
      stadiumMealCost: edition.stadiumMealCost,
      transportAirportHotelCost: edition.transportAirportHotelCost,
      transportHotelStadiumCost: edition.transportHotelStadiumCost,
    })

    // Get first application for backward compat
    const apps = await db.select().from(schema.application).where(eq(schema.application.athleteId, athleteId)).limit(1)
    const appId = apps.length > 0 ? apps[0].id : athleteId

    await db.insert(schema.contractOffer).values({
      applicationId: appId,
      athleteId,
      version: nextVersion,
      direction: 'to_organizer',
      bonus: offer.bonus,
      otherCompensation: offer.otherCompensation,
      otherCompensationDesc: offer.otherCompensationDesc ?? null,
      transport: offer.transport,
      transportAirportHotel: offer.transportAirportHotel,
      transportHotelStadium: offer.transportHotelStadium,
      hotelId: offer.hotelId ?? null,
      hotelNightTue: offer.hotelNightTue,
      hotelNightWed: offer.hotelNightWed,
      hotelNightThu: offer.hotelNightThu,
      hotelNightFri: offer.hotelNightFri,
      hotelNightSat: offer.hotelNightSat,
      hotelNightSun: offer.hotelNightSun,
      dinnerTue: offer.dinnerTue,
      dinnerWed: offer.dinnerWed,
      dinnerThu: offer.dinnerThu,
      dinnerFri: offer.dinnerFri,
      dinnerSat: offer.dinnerSat,
      dinnerSun: offer.dinnerSun,
      stadiumMeals: offer.stadiumMeals,
      notes: offer.notes ?? null,
      totalCost,
      sentBy: user.id,
      sentAt: now,
    })

    // Log interaction
    if (apps.length > 0) {
      await db.insert(schema.interaction).values({
        applicationId: apps[0].id,
        type: 'counter_offer',
        content: `Counter-offer v${nextVersion} submitted — CHF ${totalCost.toLocaleString()}`,
        authorId: user.id,
        authorName: `${user.firstName} ${user.lastName}`,
      })
    }
  }

  // Update athlete negotiation status
  await db
    .update(schema.athlete)
    .set({ negotiationStatus: targetStatus, updatedAt: now })
    .where(eq(schema.athlete.id, athleteId))

  // Also update legacy application.status on all applications
  const allApps = await db.select().from(schema.application).where(eq(schema.application.athleteId, athleteId))
  for (const app of allApps) {
    const updates: Record<string, unknown> = { status: targetStatus, updatedAt: now }
    if (['accepted', 'rejected', 'withdrawn'].includes(targetStatus)) {
      updates.decidedAt = now
    }
    await db.update(schema.application).set(updates).where(eq(schema.application.id, app.id))

    // Log status change interaction (unless counter_offer already logged)
    if (action !== 'counter_offer') {
      await db.insert(schema.interaction).values({
        applicationId: app.id,
        type: 'status_change',
        content: `Application ${action}ed by ${user.firstName} ${user.lastName}`,
        authorId: user.id,
        authorName: `${user.firstName} ${user.lastName}`,
      })
    }
  }

  // Notify collaborators via email stub
  sendEmail({
    to: 'collaborators@atleticageneve.ch',
    subject: `Application update — ${ath.firstName} ${ath.lastName}`,
    body: `${ath.firstName} ${ath.lastName} has ${action}ed the offer.\nNew status: ${targetStatus}`,
  })

  return c.json({ athleteId, status: targetStatus, previousStatus: currentStatus })
})

// ── Manager portal ───────────────────────────────────────────────────────────

// GET /portal/manager — get all athletes managed by current user
portal.get('/manager', requireAuth('manager'), async (c) => {
  const db = c.get('db')
  const user = c.get('user')!

  const athleteRows = await db
    .select()
    .from(schema.athlete)
    .where(eq(schema.athlete.managerId, user.id))

  const results = []
  for (const ath of athleteRows) {
    const appRows = await db
      .select()
      .from(schema.application)
      .where(eq(schema.application.athleteId, ath.id))

    const applications = []
    for (const app of appRows) {
      const eventRows = await db
        .select()
        .from(schema.event)
        .where(eq(schema.event.id, app.eventId))
        .limit(1)

      applications.push({
        ...app,
        event: eventRows[0] ?? null,
      })
    }

    // Contracts at athlete level
    const contracts = await db
      .select()
      .from(schema.contractOffer)
      .where(eq(schema.contractOffer.athleteId, ath.id))
      .orderBy(schema.contractOffer.version)

    results.push({
      ...ath,
      applications,
      contracts,
      latestContract: contracts.length > 0 ? contracts[contracts.length - 1] : null,
    })
  }

  // KPI summary — at athlete level
  const total = athleteRows.length
  const toReview = athleteRows.filter((a) => a.negotiationStatus === 'to_review').length
  const inNegotiation = athleteRows.filter((a) =>
    ['contract_sent', 'counter_offer'].includes(a.negotiationStatus)
  ).length
  const confirmed = athleteRows.filter((a) => a.negotiationStatus === 'accepted').length
  const rejected = athleteRows.filter((a) => a.negotiationStatus === 'rejected').length

  return c.json({
    athletes: results,
    kpi: { total, toReview, inNegotiation, confirmed, rejected },
  })
})

export default portal
