import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  setupTestContext,
  teardownTestContext,
  createUserWithSession,
  createEdition,
  createEvent,
  createAthlete,
  type TestContext,
} from './helpers'

describe('WA Performance API', () => {
  let ctx: TestContext
  let collabToken: string
  let editionId: string
  let eventId: string
  let athleteId: string

  beforeAll(async () => {
    ctx = await setupTestContext()
    const { token } = await createUserWithSession(ctx, {
      role: 'collaborator',
      firstName: 'Pierre',
      lastName: 'Collab',
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

  describe('POST /api/v1/wa-performance', () => {
    it('creates a new WA performance record', async () => {
      const res = await ctx.request('/api/v1/wa-performance', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          athleteId,
          eventId,
          personalBest: 10.05,
          seasonBest: 10.12,
          worldRanking: 15,
          eaRanking: 22,
        }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.success).toBe(true)
    })

    it('updates existing record on same athlete+event', async () => {
      const res = await ctx.request('/api/v1/wa-performance', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          athleteId,
          eventId,
          personalBest: 9.98,
          worldRanking: 8,
        }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.success).toBe(true)
    })

    it('rejects missing athleteId', async () => {
      const res = await ctx.request('/api/v1/wa-performance', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ eventId, personalBest: 10.00 }),
      })
      expect(res.status).toBe(400)
    })

    it('rejects missing eventId', async () => {
      const res = await ctx.request('/api/v1/wa-performance', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ athleteId, personalBest: 10.00 }),
      })
      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/v1/wa-performance', () => {
    it('returns performances for athlete', async () => {
      const res = await ctx.request(`/api/v1/wa-performance?athleteId=${athleteId}`, {
        headers: { Authorization: `Bearer ${collabToken}` },
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.length).toBe(1)
      expect(body[0].personalBest).toBe(9.98) // updated value (numeric now)
      expect(body[0].worldRanking).toBe(8)
      expect(body[0].eaRanking).toBe(22) // preserved — not overwritten by the second, EA-less POST
      expect(body[0].event).toBeDefined()
      expect(body[0].event.id).toBe(eventId)
    })

    it('returns empty array for athlete with no data', async () => {
      const otherId = await createAthlete(ctx, { firstName: 'No', lastName: 'Data' })
      const res = await ctx.request(`/api/v1/wa-performance?athleteId=${otherId}`, {
        headers: { Authorization: `Bearer ${collabToken}` },
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body).toEqual([])
    })

    it('rejects missing athleteId param', async () => {
      const res = await ctx.request('/api/v1/wa-performance', {
        headers: { Authorization: `Bearer ${collabToken}` },
      })
      expect(res.status).toBe(400)
    })
  })

  describe('POST /api/v1/wa-performance/fetch/:athleteId', () => {
    it('returns 400 for athlete without WA profile URL', async () => {
      const res = await ctx.request(`/api/v1/wa-performance/fetch/${athleteId}`, {
        method: 'POST',
        headers: authHeaders(),
      })
      expect(res.status).toBe(400)
      const body = await res.json() as any
      expect(body.error).toBe('No WA profile URL')
    })

    it('returns 404 for non-existent athlete', async () => {
      const res = await ctx.request('/api/v1/wa-performance/fetch/non-existent-id', {
        method: 'POST',
        headers: authHeaders(),
      })
      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/v1/wa-performance/refresh-all', () => {
    it('queues only athletes with a WA profile URL', async () => {
      await createAthlete(ctx, { firstName: 'No', lastName: 'Url' })
      await createAthlete(ctx, { firstName: 'With', lastName: 'Url', waProfileUrl: 'https://worldathletics.org/athletes/x-y/12345' })

      const res = await ctx.request('/api/v1/wa-performance/refresh-all', {
        method: 'POST',
        headers: authHeaders(),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.athletesQueued).toBe(1)
    })

    it('rejects unauthenticated requests', async () => {
      const res = await ctx.request('/api/v1/wa-performance/refresh-all', { method: 'POST' })
      expect(res.status).toBe(401)
    })
  })

  describe('Authorization', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await ctx.request(`/api/v1/wa-performance?athleteId=${athleteId}`)
      expect(res.status).toBe(401)
    })

    it('rejects athlete role', async () => {
      const { token } = await createUserWithSession(ctx, {
        role: 'athlete',
        firstName: 'Ath',
        lastName: 'Lete',
      })
      const res = await ctx.request(`/api/v1/wa-performance?athleteId=${athleteId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(403)
    })
  })
})
