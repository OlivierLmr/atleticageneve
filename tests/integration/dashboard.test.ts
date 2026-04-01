import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  setupTestContext,
  teardownTestContext,
  createUserWithSession,
  createEdition,
  createEvent,
  createAthlete,
  createApplication,
  createHotelAndRoom,
  type TestContext,
} from './helpers'
import * as schema from '@api/db/schema'

describe('Dashboard API', () => {
  let ctx: TestContext
  let committeeToken: string

  beforeAll(async () => {
    ctx = await setupTestContext()

    const { userId, token } = await createUserWithSession(ctx, {
      id: 'u-dash-com',
      role: 'committee',
      firstName: 'Dash',
      lastName: 'Board',
    })
    committeeToken = token

    // Create a collaborator for selector stats
    await createUserWithSession(ctx, {
      id: 'u-dash-collab',
      role: 'collaborator',
      firstName: 'Sel',
      lastName: 'Ector',
    })

    const editionId = await createEdition(ctx)

    // Create two events with distinct catalogs
    const evt1 = await createEvent(ctx, editionId, {
      id: 'evt-dash-1',
      catalogId: 'cat-dash-100m-M',
    })
    const evt2 = await createEvent(ctx, editionId, {
      id: 'evt-dash-2',
      catalogId: 'cat-dash-200w-F',
    })

    // Create athletes with v3 negotiation statuses (on athlete, not application)
    const ath1 = await createAthlete(ctx, {
      firstName: 'Dash1', lastName: 'A', isSwiss: true,
      negotiationStatus: 'confirmed', editionId,
    })
    const ath2 = await createAthlete(ctx, {
      firstName: 'Dash2', lastName: 'B', isEap: true,
      negotiationStatus: 'agreement_sent', editionId,
    })
    const ath3 = await createAthlete(ctx, {
      firstName: 'Dash3', lastName: 'C',
      negotiationStatus: 'to_review', editionId,
    })
    const ath4 = await createAthlete(ctx, {
      firstName: 'Dash4', lastName: 'D',
      negotiationStatus: 'rejected', editionId,
    })

    // Create applications with participation statuses
    await createApplication(ctx, {
      athleteId: ath1, eventId: evt1, editionId, participationStatus: 'selected',
    })
    await createApplication(ctx, {
      athleteId: ath2, eventId: evt1, editionId, participationStatus: 'pending',
    })
    await createApplication(ctx, {
      athleteId: ath3, eventId: evt2, editionId, participationStatus: 'pending',
    })
    await createApplication(ctx, {
      athleteId: ath4, eventId: evt2, editionId, participationStatus: 'not_selected',
    })

    // Add an agreement for budget calculation (v3: agreement table, athlete-level)
    await ctx.db.insert(schema.agreement).values({
      athleteId: ath1,
      version: 1,
      direction: 'to_athlete',
      appearanceFee: 5000,
      transport: 500,
      totalCost: 5500,
      sentBy: userId,
    })
  })

  afterAll(async () => {
    await teardownTestContext(ctx)
  })

  describe('GET /api/v1/dashboard', () => {
    it('returns dashboard KPIs', async () => {
      const res = await ctx.request('/api/v1/dashboard', {
        headers: { Authorization: `Bearer ${committeeToken}` },
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any

      expect(body.kpi).toBeDefined()
      expect(body.kpi.totalAthletes).toBe(4)
      expect(body.kpi.confirmed).toBe(1)
      expect(body.kpi.inNegotiation).toBe(1) // agreement_sent
      expect(body.kpi.toReview).toBe(1)
      expect(body.kpi.rejected).toBe(1)
    })

    it('returns budget info', async () => {
      const res = await ctx.request('/api/v1/dashboard', {
        headers: { Authorization: `Bearer ${committeeToken}` },
      })
      const body = await res.json() as any

      expect(body.kpi.budgetCommitted).toBe(5500)
      expect(body.kpi.budgetRemaining).toBe(250000 - 5500)
    })

    it('returns event stats', async () => {
      const res = await ctx.request('/api/v1/dashboard', {
        headers: { Authorization: `Bearer ${committeeToken}` },
      })
      const body = await res.json() as any

      expect(body.events).toBeDefined()
      expect(body.events.length).toBeGreaterThanOrEqual(2)

      const evt1 = body.events.find((e: any) => e.eventId === 'evt-dash-1')
      expect(evt1).toBeDefined()
      // ath1 is confirmed + selected for evt-dash-1
      expect(evt1.confirmedSelected).toBeGreaterThanOrEqual(1)
    })

    it('rejects non-committee users', async () => {
      const { token } = await createUserWithSession(ctx, {
        role: 'collaborator',
        firstName: 'Not',
        lastName: 'Committee',
      })

      const res = await ctx.request('/api/v1/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(403)
    })
  })
})
