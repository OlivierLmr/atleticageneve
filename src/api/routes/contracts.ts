import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import * as schema from '../db/schema'
import { contractOfferSchema } from '@shared/validation'
import { NEGOTIATION_TRANSITIONS } from '@shared/constants'
import { requireAuth } from '../middleware/auth'
import { sendEmail } from '../services/email'
import type { Env } from '../index'
import type { NegotiationStatus } from '@shared/types'

const contracts = new Hono<Env>()

contracts.use('*', requireAuth('collaborator', 'committee'))

// ── Helper: calculate total cost from contract fields + edition costs ────────

interface CostParams {
  bonus: number
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

interface EditionCosts {
  hotelCostPerNight: number
  dinnerCostPp: number
  stadiumMealCost: number
  transportAirportHotelCost: number
  transportHotelStadiumCost: number
}

export function calculateTotalCost(data: CostParams, costs: EditionCosts): number {
  const nights = [
    data.hotelNightTue, data.hotelNightWed, data.hotelNightThu,
    data.hotelNightFri, data.hotelNightSat, data.hotelNightSun,
  ].filter(Boolean).length

  const dinners = [
    data.dinnerTue, data.dinnerWed, data.dinnerThu,
    data.dinnerFri, data.dinnerSat, data.dinnerSun,
  ].filter(Boolean).length

  let total = data.bonus + data.otherCompensation + data.transport
  total += nights * costs.hotelCostPerNight
  total += dinners * costs.dinnerCostPp
  if (data.stadiumMeals) total += costs.stadiumMealCost
  if (data.transportAirportHotel) total += costs.transportAirportHotelCost
  if (data.transportHotelStadium) total += costs.transportHotelStadiumCost

  return total
}

// ── POST /athletes/:athleteId/contracts — create a new contract offer ────────

contracts.post('/:athleteId/contracts', async (c) => {
  const db = c.get('db')
  const user = c.get('user')!
  const athleteId = c.req.param('athleteId')

  // Parse body
  const body = await c.req.json()
  const parsed = contractOfferSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid contract data', details: parsed.error.flatten() }, 400)
  }
  const data = parsed.data

  // Verify athlete exists
  const athRows = await db.select().from(schema.athlete).where(eq(schema.athlete.id, athleteId)).limit(1)
  if (athRows.length === 0) {
    return c.json({ error: 'Athlete not found' }, 404)
  }
  const ath = athRows[0]
  const currentStatus = ath.negotiationStatus as NegotiationStatus

  // Can only send offers from to_review or counter_offer
  if (!['to_review', 'counter_offer'].includes(currentStatus)) {
    const allowed = NEGOTIATION_TRANSITIONS[currentStatus]
    if (!allowed?.includes('contract_sent')) {
      return c.json({
        error: `Cannot send offer when athlete is in "${currentStatus}" status`,
      }, 400)
    }
  }

  // Get edition costs
  const editions = await db.select().from(schema.edition).limit(1)
  if (editions.length === 0) {
    return c.json({ error: 'No edition configured' }, 400)
  }
  const edition = editions[0]

  // Get hotel cost if specified
  let hotelCostPerNight = 0
  if (data.hotelId) {
    const hotels = await db.select().from(schema.hotel).where(eq(schema.hotel.id, data.hotelId)).limit(1)
    if (hotels.length > 0) hotelCostPerNight = hotels[0].costPerNight
  }

  const editionCosts: EditionCosts = {
    hotelCostPerNight,
    dinnerCostPp: edition.dinnerCostPp,
    stadiumMealCost: edition.stadiumMealCost,
    transportAirportHotelCost: edition.transportAirportHotelCost,
    transportHotelStadiumCost: edition.transportHotelStadiumCost,
  }

  // Get the next version number (athlete-level)
  const existingContracts = await db
    .select({ version: schema.contractOffer.version })
    .from(schema.contractOffer)
    .where(eq(schema.contractOffer.athleteId, athleteId))
    .orderBy(desc(schema.contractOffer.version))
    .limit(1)

  const nextVersion = existingContracts.length > 0 ? existingContracts[0].version + 1 : 1

  const totalCost = calculateTotalCost(data, editionCosts)

  // Create contract offer
  const contractId = crypto.randomUUID()
  const now = new Date().toISOString()

  // Get first application for backward compat (applicationId is still required in DB)
  const apps = await db.select().from(schema.application).where(eq(schema.application.athleteId, athleteId)).limit(1)
  const appId = apps.length > 0 ? apps[0].id : athleteId // fallback

  await db.insert(schema.contractOffer).values({
    id: contractId,
    applicationId: appId,
    athleteId,
    version: nextVersion,
    direction: 'to_athlete',
    bonus: data.bonus,
    otherCompensation: data.otherCompensation,
    otherCompensationDesc: data.otherCompensationDesc ?? null,
    transport: data.transport,
    transportAirportHotel: data.transportAirportHotel,
    transportHotelStadium: data.transportHotelStadium,
    hotelId: data.hotelId ?? null,
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

  // Transition athlete negotiation status to contract_sent
  await db
    .update(schema.athlete)
    .set({ negotiationStatus: 'contract_sent', updatedAt: now })
    .where(eq(schema.athlete.id, athleteId))

  // Log interaction on first application
  if (apps.length > 0) {
    await db.insert(schema.interaction).values({
      applicationId: apps[0].id,
      type: 'contract',
      content: `Contract offer v${nextVersion} sent — CHF ${totalCost.toLocaleString()}`,
      authorId: user.id,
      authorName: `${user.firstName} ${user.lastName}`,
    })
  }

  // Notify athlete
  if (ath.athleteEmail) {
    sendEmail({
      to: ath.athleteEmail,
      subject: `Contract offer — ${ath.firstName} ${ath.lastName}`,
      body: `You have received a contract offer (v${nextVersion}) for Atletica Genève.\n\nBonus: CHF ${data.bonus}\nTransport: CHF ${data.transport}\nTotal: CHF ${totalCost}\n\nPlease review the offer in your portal.`,
    })
  }

  return c.json({
    id: contractId,
    athleteId,
    version: nextVersion,
    totalCost,
    direction: 'to_athlete',
  }, 201)
})

// ── GET /athletes/:athleteId/contracts — list contracts for an athlete ───────

contracts.get('/:athleteId/contracts', async (c) => {
  const db = c.get('db')
  const athleteId = c.req.param('athleteId')

  const results = await db
    .select()
    .from(schema.contractOffer)
    .where(eq(schema.contractOffer.athleteId, athleteId))
    .orderBy(schema.contractOffer.version)

  return c.json(results)
})

export default contracts
