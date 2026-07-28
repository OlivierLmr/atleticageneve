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
    it('transitions to_review -> agreement_sent via agreement creation', async () => {
      const { athleteId } = await freshApp({ participationStatus: 'selected' })

      // Sending an agreement implicitly sets status to agreement_sent
      const res = await ctx.request(`/api/v1/athletes/${athleteId}/agreements`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          appearanceFee: 1000, otherCompensation: 0, transport: 0,
          transportAirportHotel: false, transportHotelStadium: false,
          hotelNightTue: false, hotelNightWed: false,
          hotelNightThu: false, hotelNightFri: false, hotelNightSat: false,
          hotelNightSun: false,
          dinnerTue: false, dinnerWed: false, dinnerThu: false,
          dinnerFri: false, dinnerSat: false, dinnerSun: false,
          stadiumMeals: false,
        }),
      })
      expect(res.status).toBe(201)
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

      // Simulate athlete counter-offering (sets status to counter_offer_sent)
      // In the real flow, the athlete would do this via PATCH with their own token.
      // Here we directly update the DB since we're testing agreement versioning.
      const { eq } = await import('drizzle-orm')
      const { athlete: athleteTable } = await import('@api/db/schema')
      await ctx.db.update(athleteTable).set({ negotiationStatus: 'counter_offer_sent' }).where(eq(athleteTable.id, athleteId))

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

  // ── Add event application ───────────────────────────────────────────────

  describe('Add event application', () => {
    it('adds a new pending application for an eligible event', async () => {
      const athleteId = await createAthlete(ctx, { editionId, gender: 'M' })
      const newEventId = await createEvent(ctx, editionId)

      const res = await ctx.request(`/api/v1/athletes/${athleteId}/applications`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ eventId: newEventId }),
      })
      expect(res.status).toBe(201)
      const body = await res.json() as any
      expect(body.participationStatus).toBe('pending')

      const detailRes = await ctx.request(`/api/v1/athletes/${athleteId}`, {
        headers: authHeaders(),
      })
      const detail = await detailRes.json() as any
      expect(detail.applications.some((a: any) => a.eventId === newEventId)).toBe(true)
      expect(detail.interactions.some((i: any) => i.content.includes('Additional event application'))).toBe(true)
    })

    it('rejects when the event gender does not match the athlete gender', async () => {
      const athleteId = await createAthlete(ctx, { editionId, gender: 'F' })
      const newEventId = await createEvent(ctx, editionId, { catalogId: 'cat-100m-M' })

      const res = await ctx.request(`/api/v1/athletes/${athleteId}/applications`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ eventId: newEventId }),
      })
      expect(res.status).toBe(400)
    })

    it('rejects a duplicate application for the same event', async () => {
      const { athleteId, eventId: existingEventId } = await freshApp()

      const res = await ctx.request(`/api/v1/athletes/${athleteId}/applications`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ eventId: existingEventId }),
      })
      expect(res.status).toBe(409)
    })

    it('allows the athlete themselves to add a participation request', async () => {
      const { token: athleteToken, userId: athUserId } = await createUserWithSession(ctx, {
        role: 'athlete',
        firstName: 'Self',
        lastName: 'Registered',
      })
      const athleteId = await createAthlete(ctx, { editionId, gender: 'M', userId: athUserId })
      const newEventId = await createEvent(ctx, editionId)

      const res = await ctx.request(`/api/v1/athletes/${athleteId}/applications`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${athleteToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: newEventId }),
      })
      expect(res.status).toBe(201)
    })

    it('rejects an athlete adding a request for another athlete', async () => {
      const { token: athleteToken } = await createUserWithSession(ctx, {
        role: 'athlete',
        firstName: 'Other',
        lastName: 'Athlete',
      })
      const athleteId = await createAthlete(ctx, { editionId, gender: 'M' })
      const newEventId = await createEvent(ctx, editionId)

      const res = await ctx.request(`/api/v1/athletes/${athleteId}/applications`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${athleteToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: newEventId }),
      })
      expect(res.status).toBe(403)
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
