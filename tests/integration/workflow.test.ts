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

describe('Application Workflow API', () => {
  let ctx: TestContext
  let collabToken: string
  let editionId: string
  let eventId: string
  let athleteId: string

  beforeAll(async () => {
    ctx = await setupTestContext()
    const { token } = await createUserWithSession(ctx, {
      id: 'u-collab',
      role: 'collaborator',
      firstName: 'Pierre',
      lastName: 'Selector',
    })
    collabToken = token
    editionId = await createEdition(ctx)
    eventId = await createEvent(ctx, editionId)
    athleteId = await createAthlete(ctx)
  })

  afterAll(async () => {
    await teardownTestContext(ctx)
  })

  const authHeaders = () => ({
    Authorization: `Bearer ${collabToken}`,
    'Content-Type': 'application/json',
  })

  // Helper: create a fresh event + application to avoid UNIQUE conflicts
  async function freshApp(status: string = 'to_review') {
    const evtId = await createEvent(ctx, editionId)
    const appId = await createApplication(ctx, {
      athleteId,
      eventId: evtId,
      editionId,
      status,
    })
    return appId
  }

  // ── Status transitions ────────────────────────────────────────────────────

  describe('Status transitions', () => {
    it('transitions to_review → contract_sent', async () => {
      const appId = await freshApp('to_review')

      const res = await ctx.request(`/api/v1/applications/${appId}/status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: 'contract_sent' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.status).toBe('contract_sent')
    })

    it('transitions contract_sent → accepted', async () => {
      const appId = await freshApp('contract_sent')

      const res = await ctx.request(`/api/v1/applications/${appId}/status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: 'accepted' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.status).toBe('accepted')
    })

    it('transitions contract_sent → rejected', async () => {
      const appId = await freshApp('contract_sent')

      const res = await ctx.request(`/api/v1/applications/${appId}/status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: 'rejected' }),
      })
      expect(res.status).toBe(200)
    })

    it('rejects invalid transition to_review → accepted', async () => {
      const appId = await freshApp('to_review')

      const res = await ctx.request(`/api/v1/applications/${appId}/status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: 'accepted' }),
      })
      expect(res.status).toBe(400)
    })

    it('rejects transition from terminal state', async () => {
      const appId = await freshApp('accepted')

      const res = await ctx.request(`/api/v1/applications/${appId}/status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: 'rejected' }),
      })
      expect(res.status).toBe(400)
    })
  })

  // ── Contract offers ───────────────────────────────────────────────────────

  describe('Contract offers', () => {
    it('creates a contract offer and transitions to contract_sent', async () => {
      const appId = await freshApp('to_review')

      const res = await ctx.request(`/api/v1/applications/${appId}/contracts`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          bonus: 5000,
          otherCompensation: 0,
          transport: 500,
          localTransport: true,
          hotelNightThu: true,
          hotelNightFri: true,
          hotelNightSat: true,
          hotelNightTue: false,
          hotelNightWed: false,
          hotelNightSun: false,
          catering: 200,
          notes: 'Welcome offer',
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json() as any
      expect(body.version).toBe(1)
      expect(body.totalCost).toBeGreaterThan(0)
      expect(body.direction).toBe('to_athlete')
    })

    it('increments version on subsequent offers (after counter-offer)', async () => {
      const appId = await freshApp('to_review')

      // Send first offer (transitions to contract_sent)
      const res1 = await ctx.request(`/api/v1/applications/${appId}/contracts`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          bonus: 3000, otherCompensation: 0, transport: 300,
          localTransport: false, hotelNightTue: false, hotelNightWed: false,
          hotelNightThu: true, hotelNightFri: true, hotelNightSat: false,
          hotelNightSun: false, catering: 100, notes: '',
        }),
      })
      expect(res1.status).toBe(201)
      const b1 = await res1.json() as any
      expect(b1.version).toBe(1)

      // Simulate counter-offer status so we can send another offer
      await ctx.request(`/api/v1/applications/${appId}/status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: 'counter_offer' }),
      })

      // Send revised offer from counter_offer status
      const res2 = await ctx.request(`/api/v1/applications/${appId}/contracts`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          bonus: 4000, otherCompensation: 0, transport: 400,
          localTransport: false, hotelNightTue: false, hotelNightWed: false,
          hotelNightThu: true, hotelNightFri: true, hotelNightSat: true,
          hotelNightSun: false, catering: 150, notes: 'Revised',
        }),
      })
      expect(res2.status).toBe(201)
      const b2 = await res2.json() as any
      expect(b2.version).toBe(2)
    })
  })

  // ── Interactions ──────────────────────────────────────────────────────────

  describe('Interactions', () => {
    it('creates an interaction note', async () => {
      const appId = await freshApp()

      const res = await ctx.request(`/api/v1/applications/${appId}/interactions`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ type: 'note', content: 'Called agent, discussed terms' }),
      })
      expect(res.status).toBe(201)
      const body = await res.json() as any
      expect(body.id).toBeDefined()
    })
  })

  // ── Authorization ─────────────────────────────────────────────────────────

  describe('Authorization', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await ctx.request('/api/v1/applications', {
        headers: { 'Content-Type': 'application/json' },
      })
      expect(res.status).toBe(401)
    })

    it('rejects athlete role from accessing applications list', async () => {
      const { token } = await createUserWithSession(ctx, {
        role: 'athlete',
        firstName: 'Ath',
        lastName: 'Lete',
      })

      const res = await ctx.request('/api/v1/applications', {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(403)
    })

    it('allows committee role to access applications', async () => {
      const { token } = await createUserWithSession(ctx, {
        role: 'committee',
        firstName: 'Jean',
        lastName: 'Com',
      })

      const res = await ctx.request('/api/v1/applications', {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(200)
    })
  })
})
