import { Hono } from 'hono'
import { eq, or, desc, max } from 'drizzle-orm'
import * as schema from '../db/schema'
import { agreementSchema } from '@shared/validation'
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
    // Applications with event + catalog details
    const appRows = await db
      .select({
        application: schema.application,
        event: schema.event,
        catalog: schema.eventCatalog,
      })
      .from(schema.application)
      .innerJoin(schema.event, eq(schema.application.eventId, schema.event.id))
      .innerJoin(schema.eventCatalog, eq(schema.event.catalogId, schema.eventCatalog.id))
      .where(eq(schema.application.athleteId, ath.id))

    const applications = appRows.map(r => ({
      ...r.application,
      event: {
        ...r.event,
        name: r.catalog.name,
        discipline: r.catalog.discipline,
        gender: r.catalog.gender,
      },
    }))

    // Agreements at athlete level (from agreement table)
    const agreements = await db
      .select()
      .from(schema.agreement)
      .where(eq(schema.agreement.athleteId, ath.id))
      .orderBy(schema.agreement.version)

    // Strip totalCost from athlete/manager view
    const sanitizedAgreements = agreements.map(a => ({
      ...a,
      totalCost: undefined,
    }))

    // Interactions
    const interactions = await db
      .select()
      .from(schema.interaction)
      .where(eq(schema.interaction.athleteId, ath.id))
      .orderBy(desc(schema.interaction.createdAt))

    results.push({
      ...ath,
      applications,
      agreements: sanitizedAgreements,
      interactions,
    })
  }

  return c.json({ athletes: results })
})

// POST /portal/athlete/:athleteId/respond — accept, reject, withdraw, or counter-offer
portal.post('/athlete/:athleteId/respond', requireAuth('athlete', 'manager'), async (c) => {
  const db = c.get('db')
  const user = c.get('user')!
  const athleteId = c.req.param('athleteId')!
  const body = await c.req.json()
  const action = body.action as string

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
  const now = new Date().toISOString()

  // Action-specific logic
  if (action === 'accept') {
    if (currentStatus !== 'agreement_sent') {
      return c.json({ error: 'Can only accept from agreement_sent status' }, 400)
    }
    await db
      .update(schema.athlete)
      .set({ negotiationStatus: 'confirmed', decidedAt: now, updatedAt: now })
      .where(eq(schema.athlete.id, athleteId))

    await db.insert(schema.interaction).values({
      athleteId,
      type: 'status_change',
      content: `Agreement accepted by ${user.firstName} ${user.lastName}`,
      authorId: user.id,
      authorName: `${user.firstName} ${user.lastName}`,
    })

  } else if (action === 'reject') {
    if (currentStatus !== 'agreement_sent') {
      return c.json({ error: 'Can only reject from agreement_sent status' }, 400)
    }
    await db
      .update(schema.athlete)
      .set({ negotiationStatus: 'rejected', decidedAt: now, updatedAt: now })
      .where(eq(schema.athlete.id, athleteId))

    await db.insert(schema.interaction).values({
      athleteId,
      type: 'status_change',
      content: `Agreement rejected by ${user.firstName} ${user.lastName}`,
      authorId: user.id,
      authorName: `${user.firstName} ${user.lastName}`,
    })

  } else if (action === 'withdraw') {
    if (!['agreement_sent', 'counter_offer_sent', 'confirmed'].includes(currentStatus)) {
      return c.json({ error: 'Can only withdraw from agreement_sent, counter_offer_sent, or confirmed status' }, 400)
    }
    await db
      .update(schema.athlete)
      .set({ negotiationStatus: 'withdrawn', decidedAt: now, updatedAt: now })
      .where(eq(schema.athlete.id, athleteId))

    await db.insert(schema.interaction).values({
      athleteId,
      type: 'status_change',
      content: `Withdrawn by ${user.firstName} ${user.lastName}`,
      authorId: user.id,
      authorName: `${user.firstName} ${user.lastName}`,
    })

  } else if (action === 'counter_offer') {
    if (currentStatus !== 'agreement_sent') {
      return c.json({ error: 'Can only counter-offer from agreement_sent status' }, 400)
    }

    const parsed = agreementSchema.safeParse(body.offer)
    if (!parsed.success) {
      return c.json({ error: 'Invalid counter-offer data', details: parsed.error.flatten() }, 400)
    }
    const offer = parsed.data

    // Get the latest agreement (to_athlete direction) for constraint validation
    const latestAgreements = await db
      .select()
      .from(schema.agreement)
      .where(eq(schema.agreement.athleteId, athleteId))
      .orderBy(desc(schema.agreement.version))
      .limit(1)

    if (latestAgreements.length > 0) {
      const latest = latestAgreements[0]

      // Validate counter-offer constraints:
      // dinners/stadiumMeals/transport booleans: can only keep or turn OFF (not turn ON)
      const booleanFields = [
        'transportAirportHotel', 'transportHotelStadium', 'stadiumMeals',
        'dinnerTue', 'dinnerWed', 'dinnerThu', 'dinnerFri', 'dinnerSat', 'dinnerSun',
      ] as const

      for (const field of booleanFields) {
        if (offer[field] === true && latest[field] === false) {
          return c.json({ error: `Cannot turn ON ${field} in counter-offer — can only keep or turn off` }, 400)
        }
      }

      // Hotel nights: can be turned ON (athlete can request more) — no restriction
    }

    // Get next version
    const maxVersionResult = await db
      .select({ maxVersion: max(schema.agreement.version) })
      .from(schema.agreement)
      .where(eq(schema.agreement.athleteId, athleteId))

    const nextVersion = (maxVersionResult[0]?.maxVersion ?? 0) + 1

    // Calculate totalCost
    const editions = await db.select().from(schema.edition).limit(1)
    const edition = editions[0]

    let hotelCostPerNight = 0
    let dinnerCost = 0
    if (offer.hotelRoomId) {
      const rooms = await db.select().from(schema.hotelRoom).where(eq(schema.hotelRoom.id, offer.hotelRoomId)).limit(1)
      if (rooms.length > 0) {
        hotelCostPerNight = rooms[0].costPerNight
        dinnerCost = rooms[0].dinnerCost
      }
    }

    // Count hotel nights
    const nightFields = ['hotelNightTue', 'hotelNightWed', 'hotelNightThu', 'hotelNightFri', 'hotelNightSat', 'hotelNightSun'] as const
    const nightCount = nightFields.filter(f => offer[f]).length

    // Count dinners
    const dinnerFields = ['dinnerTue', 'dinnerWed', 'dinnerThu', 'dinnerFri', 'dinnerSat', 'dinnerSun'] as const
    const dinnerCount = dinnerFields.filter(f => offer[f]).length

    const hotelTotal = nightCount * hotelCostPerNight
    const dinnerTotal = dinnerCount * dinnerCost
    const stadiumMealTotal = offer.stadiumMeals ? (edition?.stadiumMealCost ?? 0) : 0
    const transportAH = offer.transportAirportHotel ? (edition?.transportAirportHotelCost ?? 0) : 0
    const transportHS = offer.transportHotelStadium ? (edition?.transportHotelStadiumCost ?? 0) : 0
    const totalCost = (offer.appearanceFee ?? 0) + (offer.otherCompensation ?? 0) + (offer.transport ?? 0)
      + hotelTotal + dinnerTotal + stadiumMealTotal + transportAH + transportHS

    await db.insert(schema.agreement).values({
      athleteId,
      version: nextVersion,
      direction: 'to_organizer',
      appearanceFee: offer.appearanceFee ?? 0,
      otherCompensation: offer.otherCompensation ?? 0,
      otherCompensationDesc: offer.otherCompensationDesc ?? null,
      transport: offer.transport ?? 0,
      transportAirportHotel: offer.transportAirportHotel ?? false,
      transportHotelStadium: offer.transportHotelStadium ?? false,
      hotelRoomId: offer.hotelRoomId ?? null,
      hotelNightTue: offer.hotelNightTue ?? false,
      hotelNightWed: offer.hotelNightWed ?? false,
      hotelNightThu: offer.hotelNightThu ?? false,
      hotelNightFri: offer.hotelNightFri ?? false,
      hotelNightSat: offer.hotelNightSat ?? false,
      hotelNightSun: offer.hotelNightSun ?? false,
      dinnerTue: offer.dinnerTue ?? false,
      dinnerWed: offer.dinnerWed ?? false,
      dinnerThu: offer.dinnerThu ?? false,
      dinnerFri: offer.dinnerFri ?? false,
      dinnerSat: offer.dinnerSat ?? false,
      dinnerSun: offer.dinnerSun ?? false,
      stadiumMeals: offer.stadiumMeals ?? false,
      notes: offer.notes ?? null,
      totalCost,
      sentBy: user.id,
      sentAt: now,
    })

    // Log interaction
    await db.insert(schema.interaction).values({
      athleteId,
      type: 'counter_offer',
      content: `Counter-offer v${nextVersion} submitted by ${user.firstName} ${user.lastName}`,
      authorId: user.id,
      authorName: `${user.firstName} ${user.lastName}`,
    })

    // Update negotiation status
    await db
      .update(schema.athlete)
      .set({ negotiationStatus: 'counter_offer_sent', updatedAt: now })
      .where(eq(schema.athlete.id, athleteId))

  } else {
    return c.json({ error: `Invalid action: ${action}` }, 400)
  }

  // Notify collaborators via email
  const updatedAth = await db.select().from(schema.athlete).where(eq(schema.athlete.id, athleteId)).limit(1)
  const newStatus = updatedAth[0]?.negotiationStatus ?? action

  sendEmail({
    to: 'collaborators@atleticageneve.ch',
    subject: `Application update — ${ath.firstName} ${ath.lastName}`,
    body: `${ath.firstName} ${ath.lastName} has ${action}ed the offer.\nNew status: ${newStatus}`,
  })

  return c.json({ athleteId, status: newStatus, previousStatus: currentStatus })
})

// ── Manager portal ───────────────────────────────────────────────────────────

// GET /portal/manager — get all athletes managed by current user with KPI summary
portal.get('/manager', requireAuth('manager'), async (c) => {
  const db = c.get('db')
  const user = c.get('user')!

  const athleteRows = await db
    .select()
    .from(schema.athlete)
    .where(eq(schema.athlete.managerId, user.id))

  const results = []
  for (const ath of athleteRows) {
    // Applications with event + catalog details
    const appRows = await db
      .select({
        application: schema.application,
        event: schema.event,
        catalog: schema.eventCatalog,
      })
      .from(schema.application)
      .innerJoin(schema.event, eq(schema.application.eventId, schema.event.id))
      .innerJoin(schema.eventCatalog, eq(schema.event.catalogId, schema.eventCatalog.id))
      .where(eq(schema.application.athleteId, ath.id))

    const applications = appRows.map(r => ({
      ...r.application,
      event: {
        ...r.event,
        name: r.catalog.name,
        discipline: r.catalog.discipline,
        gender: r.catalog.gender,
      },
    }))

    // Agreements
    const agreements = await db
      .select()
      .from(schema.agreement)
      .where(eq(schema.agreement.athleteId, ath.id))
      .orderBy(schema.agreement.version)

    results.push({
      ...ath,
      applications,
      agreements,
    })
  }

  // KPI summary — at athlete level
  const total = athleteRows.length
  const toReview = athleteRows.filter(a => a.negotiationStatus === 'to_review').length
  const inNegotiation = athleteRows.filter(a =>
    ['agreement_sent', 'counter_offer_sent'].includes(a.negotiationStatus)
  ).length
  const confirmed = athleteRows.filter(a => a.negotiationStatus === 'confirmed').length
  const rejected = athleteRows.filter(a => a.negotiationStatus === 'rejected').length
  const withdrawn = athleteRows.filter(a => a.negotiationStatus === 'withdrawn').length

  return c.json({
    athletes: results,
    kpi: { total, toReview, inNegotiation, confirmed, rejected, withdrawn },
  })
})

export default portal
