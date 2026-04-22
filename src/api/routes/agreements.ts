import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import * as schema from '../db/schema'
import { agreementSchema } from '@shared/validation'
import { requireAuth } from '../middleware/auth'
import { sendEmail, buildTransitionEmail } from '../services/email'
import type { Env } from '../index'
import type { NegotiationStatus, ParticipationStatus } from '@shared/types'

const agreements = new Hono<Env>()

agreements.use('*', requireAuth('collaborator', 'committee'))

// ── Helper: calculate total cost from agreement fields + hotel room + edition ─

interface CostParams {
  appearanceFee: number
  otherCompensation: number
  transport: number
  transportAirportHotel: boolean
  transportHotelStadium: boolean
  hotelNightTue: boolean
  hotelNightWed: boolean
  hotelNightThu: boolean
  hotelNightFri: boolean
  hotelNightSat: boolean
  hotelNightSun: boolean
  dinnerTue: boolean
  dinnerWed: boolean
  dinnerThu: boolean
  dinnerFri: boolean
  dinnerSat: boolean
  dinnerSun: boolean
  stadiumMeals: boolean
}

interface RoomCosts {
  costPerNight: number
  dinnerCost: number
}

interface EditionCosts {
  stadiumMealCost: number
  transportAirportHotelCost: number
  transportHotelStadiumCost: number
}

export function calculateTotalCost(data: CostParams, roomCosts: RoomCosts, editionCosts: EditionCosts): number {
  const nights = [
    data.hotelNightTue, data.hotelNightWed, data.hotelNightThu,
    data.hotelNightFri, data.hotelNightSat, data.hotelNightSun,
  ].filter(Boolean).length

  const dinners = [
    data.dinnerTue, data.dinnerWed, data.dinnerThu,
    data.dinnerFri, data.dinnerSat, data.dinnerSun,
  ].filter(Boolean).length

  let total = data.appearanceFee + data.otherCompensation + data.transport
  total += nights * roomCosts.costPerNight
  total += dinners * roomCosts.dinnerCost
  if (data.stadiumMeals) total += editionCosts.stadiumMealCost
  if (data.transportAirportHotel) total += editionCosts.transportAirportHotelCost
  if (data.transportHotelStadium) total += editionCosts.transportHotelStadiumCost

  return total
}

// ── POST /athletes/:athleteId/agreements — create a new agreement offer ───────

agreements.post('/:athleteId/agreements', async (c) => {
  const db = c.get('db')
  const user = c.get('user')!
  const athleteId = c.req.param('athleteId')

  // Parse body
  const body = await c.req.json()
  const parsed = agreementSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid agreement data', details: parsed.error.flatten() }, 400)
  }
  const data = parsed.data

  // Verify athlete exists
  const athRows = await db.select().from(schema.athlete).where(eq(schema.athlete.id, athleteId)).limit(1)
  if (athRows.length === 0) {
    return c.json({ error: 'Athlete not found' }, 404)
  }
  const ath = athRows[0]
  const currentStatus = ath.negotiationStatus as NegotiationStatus

  // Precondition: athlete must be in to_review or counter_offer_sent
  if (!['to_review', 'counter_offer_sent'].includes(currentStatus)) {
    return c.json({
      error: `Cannot send agreement when athlete is in "${currentStatus}" status`,
    }, 400)
  }

  // Precondition: ALL athlete's applications must have participationStatus != 'pending'
  const apps = await db
    .select()
    .from(schema.application)
    .where(eq(schema.application.athleteId, athleteId))

  const hasPending = apps.some(a => (a.participationStatus as ParticipationStatus) === 'pending')
  if (hasPending) {
    return c.json({
      error: 'All applications must have a participation decision (selected/not_selected) before sending an agreement',
    }, 400)
  }

  const hasSelected = apps.some(a => (a.participationStatus as ParticipationStatus) === 'selected')
  if (!hasSelected) {
    return c.json({
      error: 'At least one application must be selected before sending an agreement',
    }, 400)
  }

  // Get edition costs
  const editions = await db.select().from(schema.edition).limit(1)
  if (editions.length === 0) {
    return c.json({ error: 'No edition configured' }, 400)
  }
  const edition = editions[0]

  // Get hotel room costs if specified
  let roomCosts: RoomCosts = { costPerNight: 0, dinnerCost: 0 }
  if (data.hotelRoomId) {
    const rooms = await db
      .select()
      .from(schema.hotelRoom)
      .where(eq(schema.hotelRoom.id, data.hotelRoomId))
      .limit(1)
    if (rooms.length > 0) {
      roomCosts = { costPerNight: rooms[0].costPerNight, dinnerCost: rooms[0].dinnerCost }
    }
  }

  const editionCosts: EditionCosts = {
    stadiumMealCost: edition.stadiumMealCost,
    transportAirportHotelCost: edition.transportAirportHotelCost,
    transportHotelStadiumCost: edition.transportHotelStadiumCost,
  }

  // Get the next version number (athlete-level)
  const existingAgreements = await db
    .select({ version: schema.agreement.version })
    .from(schema.agreement)
    .where(eq(schema.agreement.athleteId, athleteId))
    .orderBy(desc(schema.agreement.version))
    .limit(1)

  const nextVersion = existingAgreements.length > 0 ? existingAgreements[0].version + 1 : 1

  const totalCost = calculateTotalCost(data, roomCosts, editionCosts)

  // Create agreement
  const agreementId = crypto.randomUUID()
  const now = new Date().toISOString()

  await db.insert(schema.agreement).values({
    id: agreementId,
    athleteId,
    version: nextVersion,
    direction: 'to_athlete',
    appearanceFee: data.appearanceFee,
    otherCompensation: data.otherCompensation,
    otherCompensationDesc: data.otherCompensationDesc ?? null,
    transport: data.transport,
    transportAirportHotel: data.transportAirportHotel,
    transportHotelStadium: data.transportHotelStadium,
    hotelRoomId: data.hotelRoomId ?? null,
    hotelNightTue: data.hotelNightTue,
    hotelNightWed: data.hotelNightWed,
    hotelNightThu: data.hotelNightThu,
    hotelNightFri: data.hotelNightFri,
    hotelNightSat: data.hotelNightSat,
    hotelNightSun: data.hotelNightSun,
    dinnerTue: data.dinnerTue,
    dinnerWed: data.dinnerWed,
    dinnerThu: data.dinnerThu,
    dinnerFri: data.dinnerFri,
    dinnerSat: data.dinnerSat,
    dinnerSun: data.dinnerSun,
    stadiumMeals: data.stadiumMeals,
    notes: data.notes ?? null,
    totalCost,
    sentBy: user.id,
    sentAt: now,
  })

  // Transition athlete negotiation status to agreement_sent
  await db
    .update(schema.athlete)
    .set({ negotiationStatus: 'agreement_sent', updatedAt: now })
    .where(eq(schema.athlete.id, athleteId))

  // Log interaction
  await db.insert(schema.interaction).values({
    athleteId,
    type: 'agreement',
    content: `Agreement offer v${nextVersion} sent — CHF ${totalCost.toLocaleString()}`,
    authorId: user.id,
    authorName: `${user.firstName} ${user.lastName}`,
  })

  // Build transition email for agreement_sent
  const athleteName = `${ath.firstName} ${ath.lastName}`
  const meetingName = edition.name
  const senderName = `${user.firstName} ${user.lastName}`
  const organizationName = 'Atletica Geneve'

  let recipientName = athleteName
  let managerEmail: string | null = null
  if (ath.managerId) {
    const managerRows = await db.select().from(schema.user).where(eq(schema.user.id, ath.managerId)).limit(1)
    if (managerRows.length > 0) {
      recipientName = `${managerRows[0].firstName} ${managerRows[0].lastName}`
      managerEmail = managerRows[0].email ?? null
    }
  }

  const transitionEmail = buildTransitionEmail({
    from: currentStatus as NegotiationStatus,
    to: 'agreement_sent',
    athleteName,
    meetingName,
    senderName,
    recipientName,
    organizationName,
  })

  if (transitionEmail) {
    const targetEmail = ath.athleteEmail ?? managerEmail
    if (targetEmail) {
      await sendEmail({
        db,
        to: targetEmail,
        subject: transitionEmail.subject,
        body: transitionEmail.body,
        relatedAthleteId: athleteId,
      })
    }
  }

  return c.json({
    id: agreementId,
    athleteId,
    version: nextVersion,
    totalCost,
    direction: 'to_athlete',
    emailPreview: transitionEmail ?? undefined,
  }, 201)
})

// ── GET /athletes/:athleteId/agreements — list agreements for an athlete ──────

agreements.get('/:athleteId/agreements', async (c) => {
  const db = c.get('db')
  const athleteId = c.req.param('athleteId')

  const results = await db
    .select()
    .from(schema.agreement)
    .where(eq(schema.agreement.athleteId, athleteId))
    .orderBy(schema.agreement.version)

  return c.json(results)
})

export default agreements
