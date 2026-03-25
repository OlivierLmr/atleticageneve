import { Hono } from 'hono'
import { eq, sql, desc } from 'drizzle-orm'
import * as schema from '../db/schema'
import { contractOfferSchema } from '@shared/validation'
import { VALID_TRANSITIONS, HOTEL_COST_PER_NIGHT } from '@shared/constants'
import { requireAuth } from '../middleware/auth'
import { sendEmail } from '../services/email'
import type { Env } from '../index'
import type { ApplicationStatus } from '@shared/types'

const contracts = new Hono<Env>()

contracts.use('*', requireAuth('collaborator', 'committee'))

// ── Helper: calculate total cost from contract fields ────────────────────────

function calculateTotalCost(data: {
  bonus: number
  otherCompensation: number
  transport: number
  catering: number
  hotelNightTue: boolean
  hotelNightWed: boolean
  hotelNightThu: boolean
  hotelNightFri: boolean
  hotelNightSat: boolean
  hotelNightSun: boolean
}, hotelCostPerNight: number): number {
  const nights = [
    data.hotelNightTue, data.hotelNightWed, data.hotelNightThu,
    data.hotelNightFri, data.hotelNightSat, data.hotelNightSun,
  ].filter(Boolean).length

  return data.bonus + data.otherCompensation + data.transport +
    data.catering + (nights * hotelCostPerNight)
}

// ── POST /applications/:appId/contracts — create a new contract offer ────────

contracts.post('/:appId/contracts', async (c) => {
  const db = c.get('db')
  const user = c.get('user')!
  const appId = c.req.param('appId')

  // Parse body
  const body = await c.req.json()
  const parsed = contractOfferSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid contract data', details: parsed.error.flatten() }, 400)
  }
  const data = parsed.data

  // Verify application exists
  const apps = await db
    .select()
    .from(schema.application)
    .where(eq(schema.application.id, appId))
    .limit(1)

  if (apps.length === 0) {
    return c.json({ error: 'Application not found' }, 404)
  }

  const app = apps[0]
  const currentStatus = app.status as ApplicationStatus

  // Can only send offers from to_review or counter_offer
  if (!['to_review', 'counter_offer'].includes(currentStatus)) {
    const allowed = VALID_TRANSITIONS[currentStatus]
    if (!allowed?.includes('contract_sent')) {
      return c.json({
        error: `Cannot send offer when application is in "${currentStatus}" status`,
      }, 400)
    }
  }

  // Get the next version number
  const existingContracts = await db
    .select({ version: schema.contractOffer.version })
    .from(schema.contractOffer)
    .where(eq(schema.contractOffer.applicationId, appId))
    .orderBy(desc(schema.contractOffer.version))
    .limit(1)

  const nextVersion = existingContracts.length > 0 ? existingContracts[0].version + 1 : 1

  // Calculate total cost
  const totalCost = calculateTotalCost(data, HOTEL_COST_PER_NIGHT)

  // Create contract offer
  const contractId = crypto.randomUUID()
  const now = new Date().toISOString()

  await db.insert(schema.contractOffer).values({
    id: contractId,
    applicationId: appId,
    version: nextVersion,
    direction: 'to_athlete',
    bonus: data.bonus,
    otherCompensation: data.otherCompensation,
    transport: data.transport,
    localTransport: data.localTransport,
    hotelNightTue: data.hotelNightTue,
    hotelNightWed: data.hotelNightWed,
    hotelNightThu: data.hotelNightThu,
    hotelNightFri: data.hotelNightFri,
    hotelNightSat: data.hotelNightSat,
    hotelNightSun: data.hotelNightSun,
    catering: data.catering,
    notes: data.notes ?? null,
    totalCost,
    sentBy: user.id,
    sentAt: now,
  })

  // Transition application to contract_sent
  await db
    .update(schema.application)
    .set({
      status: 'contract_sent',
      estAppearance: data.bonus + data.otherCompensation,
      estTravel: data.transport,
      estAccommodation: calculateHotelCost(data, HOTEL_COST_PER_NIGHT) + data.catering,
      estTotal: totalCost,
      updatedAt: now,
    })
    .where(eq(schema.application.id, appId))

  // Log interaction
  await db.insert(schema.interaction).values({
    applicationId: appId,
    type: 'contract',
    content: `Contract offer v${nextVersion} sent — CHF ${totalCost.toLocaleString()}`,
    authorId: user.id,
    authorName: `${user.firstName} ${user.lastName}`,
  })

  // Notify athlete
  const athletes = await db
    .select()
    .from(schema.athlete)
    .where(eq(schema.athlete.id, app.athleteId))
    .limit(1)

  if (athletes.length > 0 && athletes[0].athleteEmail) {
    sendEmail({
      to: athletes[0].athleteEmail,
      subject: `Contract offer — ${athletes[0].firstName} ${athletes[0].lastName}`,
      body: `You have received a contract offer (v${nextVersion}) for Atletica Genève.\n\nBonus: CHF ${data.bonus}\nTransport: CHF ${data.transport}\nTotal: CHF ${totalCost}\n\nPlease review the offer in your portal.`,
    })
  }

  return c.json({
    id: contractId,
    applicationId: appId,
    version: nextVersion,
    totalCost,
    direction: 'to_athlete',
  }, 201)
})

// ── GET /applications/:appId/contracts — list contracts for an application ───

contracts.get('/:appId/contracts', async (c) => {
  const db = c.get('db')
  const appId = c.req.param('appId')

  const results = await db
    .select()
    .from(schema.contractOffer)
    .where(eq(schema.contractOffer.applicationId, appId))
    .orderBy(schema.contractOffer.version)

  return c.json(results)
})

// ── Helper: calculate hotel-only cost ────────────────────────────────────────

function calculateHotelCost(data: {
  hotelNightTue: boolean
  hotelNightWed: boolean
  hotelNightThu: boolean
  hotelNightFri: boolean
  hotelNightSat: boolean
  hotelNightSun: boolean
}, costPerNight: number): number {
  return [
    data.hotelNightTue, data.hotelNightWed, data.hotelNightThu,
    data.hotelNightFri, data.hotelNightSat, data.hotelNightSun,
  ].filter(Boolean).length * costPerNight
}

export default contracts
