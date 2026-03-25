import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  setupTestContext,
  teardownTestContext,
  createUserWithSession,
  createEdition,
  createEvent,
  createAthlete,
  createApplication,
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

    const editionId = await createEdition(ctx)
    const evt1 = await createEvent(ctx, editionId, { id: 'evt-dash-1', name: '100m Men', discipline: '100m', gender: 'M' })
    const evt2 = await createEvent(ctx, editionId, { id: 'evt-dash-2', name: '200m Women', discipline: '200m', gender: 'F' })

    // Create athletes and applications in various states
    const ath1 = await createAthlete(ctx, { firstName: 'Dash1', lastName: 'A', isSwiss: true })
    const ath2 = await createAthlete(ctx, { firstName: 'Dash2', lastName: 'B', isEap: true })
    const ath3 = await createAthlete(ctx, { firstName: 'Dash3', lastName: 'C' })
    const ath4 = await createAthlete(ctx, { firstName: 'Dash4', lastName: 'D' })

    await createApplication(ctx, { athleteId: ath1, eventId: evt1, editionId, status: 'accepted' })
    await createApplication(ctx, { athleteId: ath2, eventId: evt1, editionId, status: 'contract_sent' })
    await createApplication(ctx, { athleteId: ath3, eventId: evt2, editionId, status: 'to_review' })
    await createApplication(ctx, { athleteId: ath4, eventId: evt2, editionId, status: 'rejected' })

    // Add a contract for committed budget calculation
    await ctx.db.insert(schema.contractOffer).values({
      applicationId: (await ctx.db.select().from(schema.application))[0].id,
      version: 1,
      direction: 'to_athlete',
      bonus: 5000,
      transport: 500,
      catering: 200,
      totalCost: 6150,
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
      expect(body.kpi.confirmed).toBe(1)
      expect(body.kpi.inNegotiation).toBe(1) // contract_sent
      expect(body.kpi.toReview).toBe(1)
      expect(body.kpi.totalApplications).toBeGreaterThanOrEqual(4)
    })

    it('returns event fill rates', async () => {
      const res = await ctx.request('/api/v1/dashboard', {
        headers: { Authorization: `Bearer ${committeeToken}` },
      })
      const body = await res.json() as any
      expect(body.events).toBeDefined()
      expect(body.events.length).toBeGreaterThanOrEqual(2)

      const evt1 = body.events.find((e: any) => e.eventId === 'evt-dash-1')
      expect(evt1).toBeDefined()
      expect(evt1.confirmed).toBeGreaterThanOrEqual(1)
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
