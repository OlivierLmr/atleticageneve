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
  let collabUserId: string
  let editionId: string
  let eventId: string

  beforeAll(async () => {
    ctx = await setupTestContext()
    const { userId, token } = await createUserWithSession(ctx, {
      id: 'u-collab',
      role: 'collaborator',
      firstName: 'Pierre',
      lastName: 'Selector',
    })
    collabToken = token
    collabUserId = userId
    editionId = await createEdition(ctx)
    eventId = await createEvent(ctx, editionId)
  })

  afterAll(async () => {
    await teardownTestContext(ctx)
  })

  const authHeaders = () => ({
    Authorization: `Bearer ${collabToken}`,
    'Content-Type': 'application/json',
  })

  // Helper: create a fresh athlete + event + application
  async function freshApp(opts: {
    negotiationStatus?: string
    participationStatus?: string
  } = {}) {
    const { negotiationStatus = 'to_review', participationStatus = 'pending' } = opts
    const athleteId = await createAthlete(ctx, { negotiationStatus, editionId })
    const evtId = await createEvent(ctx, editionId)
    const appId = await createApplication(ctx, {
      athleteId,
      eventId: evtId,
      editionId,
      participationStatus,
    })
    return { appId, athleteId, eventId: evtId }
  }

  // ── Negotiation status transitions (athlete-level) ──────────────────────

  describe('Negotiation status transitions', () => {
    it('transitions to_review -> agreement_sent', async () => {
      const { athleteId } = await freshApp()

      const res = await ctx.request(`/api/v1/athletes/${athleteId}/negotiation-status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: 'agreement_sent' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.status).toBe('agreement_sent')
    })

    it('transitions to_review -> rejected', async () => {
      const { athleteId } = await freshApp()

      const res = await ctx.request(`/api/v1/athletes/${athleteId}/negotiation-status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: 'rejected' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.status).toBe('rejected')
    })

    it('rejects invalid transition to_review -> confirmed', async () => {
      const { athleteId } = await freshApp()

      const res = await ctx.request(`/api/v1/athletes/${athleteId}/negotiation-status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: 'confirmed' }),
      })
      expect(res.status).toBe(400)
    })

    it('rejects transition from terminal state', async () => {
      const { athleteId } = await freshApp({ negotiationStatus: 'rejected' })

      const res = await ctx.request(`/api/v1/athletes/${athleteId}/negotiation-status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: 'agreement_sent' }),
      })
      expect(res.status).toBe(400)
    })
  })

  // ── Participation status transitions (application-level) ────────────────

  describe('Participation status transitions', () => {
    it('transitions pending -> selected', async () => {
      const { appId } = await freshApp()

      const res = await ctx.request(`/api/v1/applications/${appId}/participation-status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ participationStatus: 'selected' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.participationStatus).toBe('selected')
    })

    it('transitions pending -> not_selected', async () => {
      const { appId } = await freshApp()

      const res = await ctx.request(`/api/v1/applications/${appId}/participation-status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ participationStatus: 'not_selected' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.participationStatus).toBe('not_selected')
    })

    it('rejects invalid transition', async () => {
      // not_selected -> pending is not allowed
      const { appId } = await freshApp({ participationStatus: 'not_selected' })

      const res = await ctx.request(`/api/v1/applications/${appId}/participation-status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ participationStatus: 'pending' }),
      })
      expect(res.status).toBe(400)
    })
  })

  // ── Agreements (athlete-level, replaces contracts) ──────────────────────

  describe('Agreements', () => {
    it('creates an agreement and transitions to agreement_sent', async () => {
      // Need participation decided before agreement can be sent
      const { athleteId, appId } = await freshApp({ participationStatus: 'selected' })

      const res = await ctx.request(`/api/v1/athletes/${athleteId}/agreements`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          appearanceFee: 5000,
          otherCompensation: 0,
          transport: 500,
          transportAirportHotel: true,
          transportHotelStadium: false,
          hotelNightTue: false,
          hotelNightWed: false,
          hotelNightThu: true,
          hotelNightFri: true,
          hotelNightSat: true,
          hotelNightSun: false,
          dinnerTue: false,
          dinnerWed: false,
          dinnerThu: true,
          dinnerFri: true,
          dinnerSat: false,
          dinnerSun: false,
          stadiumMeals: true,
          notes: 'Welcome offer',
        }),
      })
      expect(res.status).toBe(201)
      const body = await res.json() as any
      expect(body.version).toBe(1)
      expect(body.totalCost).toBeGreaterThan(0)
      expect(body.direction).toBe('to_athlete')
    })

    it('rejects agreement when application still pending', async () => {
      const { athleteId } = await freshApp({ participationStatus: 'pending' })

      const res = await ctx.request(`/api/v1/athletes/${athleteId}/agreements`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          appearanceFee: 3000,
          otherCompensation: 0,
          transport: 300,
          transportAirportHotel: false,
          transportHotelStadium: false,
          hotelNightTue: false,
          hotelNightWed: false,
          hotelNightThu: false,
          hotelNightFri: false,
          hotelNightSat: false,
          hotelNightSun: false,
          dinnerTue: false,
          dinnerWed: false,
          dinnerThu: false,
          dinnerFri: false,
          dinnerSat: false,
          dinnerSun: false,
          stadiumMeals: false,
        }),
      })
      expect(res.status).toBe(400)
    })

    it('increments version on subsequent agreements', async () => {
      const { athleteId } = await freshApp({ participationStatus: 'selected' })

      // Send first agreement (v1, transitions to agreement_sent)
      const res1 = await ctx.request(`/api/v1/athletes/${athleteId}/agreements`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          appearanceFee: 3000, otherCompensation: 0, transport: 300,
          transportAirportHotel: false, transportHotelStadium: false,
          hotelNightTue: false, hotelNightWed: false,
          hotelNightThu: true, hotelNightFri: true, hotelNightSat: false,
          hotelNightSun: false,
          dinnerTue: false, dinnerWed: false, dinnerThu: false,
          dinnerFri: false, dinnerSat: false, dinnerSun: false,
          stadiumMeals: false, notes: '',
        }),
      })
      expect(res1.status).toBe(201)
      const b1 = await res1.json() as any
      expect(b1.version).toBe(1)

      // Transition to counter_offer_sent so we can send another agreement
      await ctx.request(`/api/v1/athletes/${athleteId}/negotiation-status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: 'counter_offer_sent' }),
      })

      // Send second agreement (v2)
      const res2 = await ctx.request(`/api/v1/athletes/${athleteId}/agreements`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          appearanceFee: 4000, otherCompensation: 0, transport: 400,
          transportAirportHotel: false, transportHotelStadium: false,
          hotelNightTue: false, hotelNightWed: false,
          hotelNightThu: true, hotelNightFri: true, hotelNightSat: true,
          hotelNightSun: false,
          dinnerTue: false, dinnerWed: false, dinnerThu: true,
          dinnerFri: true, dinnerSat: false, dinnerSun: false,
          stadiumMeals: false, notes: 'Revised',
        }),
      })
      expect(res2.status).toBe(201)
      const b2 = await res2.json() as any
      expect(b2.version).toBe(2)
    })

    it('lists agreements for an athlete', async () => {
      const { athleteId } = await freshApp({ participationStatus: 'selected' })

      // Create one agreement
      await ctx.request(`/api/v1/athletes/${athleteId}/agreements`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          appearanceFee: 2000, otherCompensation: 0, transport: 200,
          transportAirportHotel: false, transportHotelStadium: false,
          hotelNightTue: false, hotelNightWed: false,
          hotelNightThu: false, hotelNightFri: false, hotelNightSat: false,
          hotelNightSun: false,
          dinnerTue: false, dinnerWed: false, dinnerThu: false,
          dinnerFri: false, dinnerSat: false, dinnerSun: false,
          stadiumMeals: false,
        }),
      })

      const res = await ctx.request(`/api/v1/athletes/${athleteId}/agreements`, {
        headers: { Authorization: `Bearer ${collabToken}` },
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.length).toBe(1)
      expect(body[0].direction).toBe('to_athlete')
    })
  })

  // ── Interactions ────────────────────────────────────────────────────────

  describe('Interactions', () => {
    it('creates an interaction note', async () => {
      const { appId } = await freshApp()

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
