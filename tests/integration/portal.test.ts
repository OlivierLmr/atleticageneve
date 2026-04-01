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

describe('Portal API', () => {
  let ctx: TestContext
  let editionId: string
  let eventId: string

  beforeAll(async () => {
    ctx = await setupTestContext()
    editionId = await createEdition(ctx)
    eventId = await createEvent(ctx, editionId)
  })

  afterAll(async () => {
    await teardownTestContext(ctx)
  })

  // ── Athlete portal ────────────────────────────────────────────────────────

  describe('GET /api/v1/portal/athlete', () => {
    it('returns athletes for athlete user', async () => {
      const { userId, token } = await createUserWithSession(ctx, {
        role: 'athlete',
        firstName: 'Marcell',
        lastName: 'Jacobs',
      })
      const athleteId = await createAthlete(ctx, { userId })
      await createApplication(ctx, { athleteId, eventId, editionId })

      const res = await ctx.request('/api/v1/portal/athlete', {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.athletes.length).toBe(1)
      expect(body.athletes[0].firstName).toBe('Test')
    })

    it('returns athletes for manager acting on behalf', async () => {
      const { userId: managerId, token } = await createUserWithSession(ctx, {
        role: 'manager',
        firstName: 'Agent',
        lastName: 'Manager',
      })
      const athleteId = await createAthlete(ctx, { managerId })
      await createApplication(ctx, { athleteId, eventId, editionId })

      const res = await ctx.request('/api/v1/portal/athlete', {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.athletes.length).toBeGreaterThanOrEqual(1)
    })

    it('returns empty for user with no athletes', async () => {
      const { token } = await createUserWithSession(ctx, {
        role: 'athlete',
        firstName: 'No',
        lastName: 'Athletes',
      })

      const res = await ctx.request('/api/v1/portal/athlete', {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.athletes).toEqual([])
    })
  })

  // ── Athlete respond (v3: athlete-level negotiation) ─────────────────────

  describe('POST /api/v1/portal/athlete/:athleteId/respond', () => {
    it('allows athlete to accept from agreement_sent', async () => {
      const { userId, token } = await createUserWithSession(ctx, {
        role: 'athlete',
        firstName: 'Accept',
        lastName: 'Test',
      })
      const athleteId = await createAthlete(ctx, {
        userId,
        negotiationStatus: 'agreement_sent',
      })
      await createApplication(ctx, { athleteId, eventId, editionId })

      const res = await ctx.request(`/api/v1/portal/athlete/${athleteId}/respond`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'accept' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.status).toBe('confirmed')
    })

    it('allows athlete to reject from agreement_sent', async () => {
      const { userId, token } = await createUserWithSession(ctx, {
        role: 'athlete',
        firstName: 'Reject',
        lastName: 'Test',
      })
      const athleteId = await createAthlete(ctx, {
        userId,
        negotiationStatus: 'agreement_sent',
      })
      await createApplication(ctx, { athleteId, eventId, editionId })

      const res = await ctx.request(`/api/v1/portal/athlete/${athleteId}/respond`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'reject' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.status).toBe('rejected')
    })

    it('allows athlete to withdraw from agreement_sent', async () => {
      const { userId, token } = await createUserWithSession(ctx, {
        role: 'athlete',
        firstName: 'Withdraw',
        lastName: 'Test',
      })
      const athleteId = await createAthlete(ctx, {
        userId,
        negotiationStatus: 'agreement_sent',
      })
      await createApplication(ctx, { athleteId, eventId, editionId })

      const res = await ctx.request(`/api/v1/portal/athlete/${athleteId}/respond`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'withdraw' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.status).toBe('withdrawn')
    })

    it('rejects action from unauthorized user', async () => {
      const { userId: ownerId } = await createUserWithSession(ctx, {
        role: 'athlete',
        firstName: 'Owner',
        lastName: 'Ath',
      })
      const athleteId = await createAthlete(ctx, {
        userId: ownerId,
        negotiationStatus: 'agreement_sent',
      })
      await createApplication(ctx, { athleteId, eventId, editionId })

      const { token: otherToken } = await createUserWithSession(ctx, {
        role: 'athlete',
        firstName: 'Other',
        lastName: 'User',
      })

      const res = await ctx.request(`/api/v1/portal/athlete/${athleteId}/respond`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${otherToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'accept' }),
      })
      expect(res.status).toBe(403)
    })

    it('rejects invalid transition (accept from to_review)', async () => {
      const { userId, token } = await createUserWithSession(ctx, {
        role: 'athlete',
        firstName: 'Invalid',
        lastName: 'Trans',
      })
      const athleteId = await createAthlete(ctx, {
        userId,
        negotiationStatus: 'to_review',
      })
      await createApplication(ctx, { athleteId, eventId, editionId })

      const res = await ctx.request(`/api/v1/portal/athlete/${athleteId}/respond`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'accept' }),
      })
      expect(res.status).toBe(400)
    })
  })

  // ── Manager portal ────────────────────────────────────────────────────────

  describe('GET /api/v1/portal/manager', () => {
    it('returns managed athletes and KPIs', async () => {
      const { userId: managerId, token } = await createUserWithSession(ctx, {
        role: 'manager',
        firstName: 'KPI',
        lastName: 'Manager',
      })
      const ath1 = await createAthlete(ctx, {
        managerId, firstName: 'A1', lastName: 'Test',
        negotiationStatus: 'to_review',
      })
      const ath2 = await createAthlete(ctx, {
        managerId, firstName: 'A2', lastName: 'Test',
        negotiationStatus: 'confirmed',
      })
      await createApplication(ctx, { athleteId: ath1, eventId, editionId })
      await createApplication(ctx, { athleteId: ath2, eventId, editionId })

      const res = await ctx.request('/api/v1/portal/manager', {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.athletes.length).toBe(2)
      expect(body.kpi).toBeDefined()
      expect(body.kpi.total).toBe(2)
      expect(body.kpi.confirmed).toBe(1)
      expect(body.kpi.toReview).toBe(1)
    })
  })
})
