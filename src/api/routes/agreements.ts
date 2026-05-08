import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, desc } from 'drizzle-orm'
import * as schema from '../db/schema'
import { agreementSchema } from '@shared/validation'
import { requireAuth } from '../middleware/auth'
import { sendEmail, buildTransitionEmail } from '../services/email'
import { formatAgreementTerms, formatAgreementTermsHtml } from '@shared/agreementFormatter'
import { calculateTotalCost } from '../lib/helpers'
import type { Env } from '../index'
import type { NegotiationStatus, ParticipationStatus } from '@shared/types'

const agreements = new Hono<Env>()

agreements.use('*', requireAuth('collaborator', 'committee'))

// ── POST /athletes/:athleteId/agreements — create a new agreement offer ───────

agreements.post('/:athleteId/agreements', zValidator('json', agreementSchema), async (c) => {
  const db = c.get('db')
  const user = c.get('user')!
  const athleteId = c.req.param('athleteId')
  const data = c.req.valid('json')

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

  // Fetch all applications with event + catalog (needed for status checks and event names)
  const appsWithDetails = await db
    .select({
      application: schema.application,
      catalogName: schema.eventCatalog.name,
      catalogGender: schema.eventCatalog.gender,
    })
    .from(schema.application)
    .innerJoin(schema.event, eq(schema.application.eventId, schema.event.id))
    .innerJoin(schema.eventCatalog, eq(schema.event.catalogId, schema.eventCatalog.id))
    .where(eq(schema.application.athleteId, athleteId))

  const hasPending = appsWithDetails.some(r => (r.application.participationStatus as ParticipationStatus) === 'pending')
  if (hasPending) {
    return c.json({
      error: 'All applications must have a participation decision (selected/not_selected) before sending an agreement',
    }, 400)
  }

  const hasSelected = appsWithDetails.some(r => (r.application.participationStatus as ParticipationStatus) === 'selected')
  if (!hasSelected) {
    return c.json({
      error: 'At least one application must be selected before sending an agreement',
    }, 400)
  }

  const selectedEventNames = appsWithDetails
    .filter(r => (r.application.participationStatus as ParticipationStatus) === 'selected')
    .map(r => `${r.catalogName} ${r.catalogGender === 'M' ? 'Men' : 'Women'}`)

  // Get edition costs
  const editions = await db.select().from(schema.edition).limit(1)
  if (editions.length === 0) {
    return c.json({ error: 'No edition configured' }, 400)
  }
  const edition = editions[0]

  // Get hotel room costs and hotel name if specified
  let roomCosts = { costPerNight: 0, dinnerCost: 0 }
  let hotelName: string | null = null
  let hotelRoomType: string | null = null
  if (data.hotelRoomId) {
    const roomRows = await db
      .select({
        room: schema.hotelRoom,
        hotelName: schema.hotel.name,
      })
      .from(schema.hotelRoom)
      .leftJoin(schema.hotel, eq(schema.hotelRoom.hotelId, schema.hotel.id))
      .where(eq(schema.hotelRoom.id, data.hotelRoomId))
      .limit(1)
    if (roomRows.length > 0) {
      roomCosts = { costPerNight: roomRows[0].room.costPerNight, dinnerCost: roomRows[0].room.dinnerCost }
      hotelName = roomRows[0].hotelName ?? null
      hotelRoomType = roomRows[0].room.roomType ?? null
    }
  }

  const editionCosts = {
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

  // Build the agreement object with hotel info for formatting
  const agreementForFormat = {
    id: agreementId,
    athleteId,
    version: nextVersion,
    direction: 'to_athlete' as const,
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
    createdAt: now,
    hotelName,
    hotelRoomType,
  }

  const agreementTerms = formatAgreementTerms(agreementForFormat, selectedEventNames, edition.name, 'en')
  const agreementHtmlTerms = formatAgreementTermsHtml(agreementForFormat, selectedEventNames, edition.name, 'en')

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
    agreementTerms,
    agreementHtmlTerms,
  })

  let emailLogId: string | null = null
  if (transitionEmail) {
    const targetEmail = ath.athleteEmail ?? managerEmail
    if (targetEmail) {
      emailLogId = await sendEmail({
        db,
        to: targetEmail,
        subject: transitionEmail.subject,
        body: transitionEmail.body,
        htmlBody: transitionEmail.htmlBody,
        relatedAthleteId: athleteId,
      })
    }
  }

  // Log interaction after email so we can link the emailLogId
  await db.insert(schema.interaction).values({
    athleteId,
    type: 'agreement',
    content: `Agreement offer v${nextVersion} sent — CHF ${totalCost.toLocaleString()}`,
    authorId: user.id,
    authorName: `${user.firstName} ${user.lastName}`,
    authorRole: user.role,
    emailLogId,
    createdAt: new Date().toISOString(),
  })

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
