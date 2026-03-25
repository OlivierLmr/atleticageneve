import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTestContext, teardownTestContext, createUserWithSession, type TestContext } from './helpers'
import { hashPassword } from '@api/services/auth'
import * as schema from '@api/db/schema'

describe('Auth API', () => {
  let ctx: TestContext

  beforeAll(async () => {
    ctx = await setupTestContext()
  })

  afterAll(async () => {
    await teardownTestContext(ctx)
  })

  // ── POST /auth/login ──────────────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    it('returns 401 for non-existent user', async () => {
      const res = await ctx.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'nobody', password: 'pass' }),
      })
      expect(res.status).toBe(401)
    })

    it('returns 401 for wrong password', async () => {
      const hash = await hashPassword('correctpass')
      await ctx.db.insert(schema.user).values({
        id: 'u-login-wrong',
        role: 'collaborator',
        username: 'loginwrong',
        passwordHash: hash,
        firstName: 'Test',
        lastName: 'Wrong',
      })

      const res = await ctx.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'loginwrong', password: 'wrongpass' }),
      })
      expect(res.status).toBe(401)
    })

    it('returns token and user on valid credentials', async () => {
      const hash = await hashPassword('mypassword')
      await ctx.db.insert(schema.user).values({
        id: 'u-login-ok',
        role: 'collaborator',
        username: 'loginok',
        passwordHash: hash,
        firstName: 'Pierre',
        lastName: 'Test',
      })

      const res = await ctx.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'loginok', password: 'mypassword' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.token).toBeDefined()
      expect(body.user.role).toBe('collaborator')
      expect(body.user.firstName).toBe('Pierre')
    })

    it('returns 401 for inactive user', async () => {
      const hash = await hashPassword('pass')
      await ctx.db.insert(schema.user).values({
        id: 'u-inactive',
        role: 'collaborator',
        username: 'inactive',
        passwordHash: hash,
        firstName: 'Inactive',
        lastName: 'User',
        isActive: false,
      })

      const res = await ctx.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'inactive', password: 'pass' }),
      })
      expect(res.status).toBe(401)
    })
  })

  // ── POST /auth/identify ───────────────────────────────────────────────────

  describe('POST /api/v1/auth/identify', () => {
    it('returns not_found for unknown identifier', async () => {
      const res = await ctx.request('/api/v1/auth/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'unknown@test.com' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.method).toBe('not_found')
    })

    it('returns password for user with password_hash', async () => {
      const hash = await hashPassword('pass')
      await ctx.db.insert(schema.user).values({
        id: 'u-id-pw',
        role: 'collaborator',
        username: 'idpw',
        passwordHash: hash,
        firstName: 'Id',
        lastName: 'Pw',
      })

      const res = await ctx.request('/api/v1/auth/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'idpw' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.method).toBe('password')
    })

    it('returns magic_link for user without password', async () => {
      await ctx.db.insert(schema.user).values({
        id: 'u-id-ml',
        role: 'manager',
        email: 'magic@test.com',
        firstName: 'Magic',
        lastName: 'Link',
      })

      const res = await ctx.request('/api/v1/auth/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'magic@test.com' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.method).toBe('magic_link')
    })
  })

  // ── POST /auth/magic-link ─────────────────────────────────────────────────

  describe('POST /api/v1/auth/magic-link', () => {
    it('returns success even for unknown email', async () => {
      const res = await ctx.request('/api/v1/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nonexistent@test.com' }),
      })
      expect(res.status).toBe(200)
    })

    it('creates magic link for existing user', async () => {
      await ctx.db.insert(schema.user).values({
        id: 'u-ml-test',
        role: 'athlete',
        email: 'mltest@test.com',
        firstName: 'ML',
        lastName: 'Test',
      })

      const res = await ctx.request('/api/v1/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'mltest@test.com' }),
      })
      expect(res.status).toBe(200)

      // Verify magic link was created in DB
      const links = await ctx.db.select().from(schema.magicLink)
      const userLinks = links.filter((l) => l.userId === 'u-ml-test')
      expect(userLinks.length).toBeGreaterThan(0)
    })
  })

  // ── POST /auth/verify-magic-link ──────────────────────────────────────────

  describe('POST /api/v1/auth/verify-magic-link', () => {
    it('returns 401 for invalid token', async () => {
      const res = await ctx.request('/api/v1/auth/verify-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'invalid-token' }),
      })
      expect(res.status).toBe(401)
    })

    it('verifies valid token and returns session', async () => {
      await ctx.db.insert(schema.user).values({
        id: 'u-verify',
        role: 'athlete',
        email: 'verify@test.com',
        firstName: 'Verify',
        lastName: 'Test',
      })
      const token = crypto.randomUUID()
      await ctx.db.insert(schema.magicLink).values({
        userId: 'u-verify',
        token,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      })

      const res = await ctx.request('/api/v1/auth/verify-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.token).toBeDefined()
      expect(body.user.role).toBe('athlete')
    })

    it('returns 401 for already-used token', async () => {
      await ctx.db.insert(schema.user).values({
        id: 'u-used',
        role: 'athlete',
        email: 'used@test.com',
        firstName: 'Used',
        lastName: 'Token',
      })
      const token = crypto.randomUUID()
      await ctx.db.insert(schema.magicLink).values({
        userId: 'u-used',
        token,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        used: true,
      })

      const res = await ctx.request('/api/v1/auth/verify-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      expect(res.status).toBe(401)
    })

    it('returns 401 for expired token', async () => {
      await ctx.db.insert(schema.user).values({
        id: 'u-expired',
        role: 'athlete',
        email: 'expired@test.com',
        firstName: 'Expired',
        lastName: 'Token',
      })
      const token = crypto.randomUUID()
      await ctx.db.insert(schema.magicLink).values({
        userId: 'u-expired',
        token,
        expiresAt: new Date(Date.now() - 1000).toISOString(), // already expired
      })

      const res = await ctx.request('/api/v1/auth/verify-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      expect(res.status).toBe(401)
    })
  })

  // ── GET /auth/me ──────────────────────────────────────────────────────────

  describe('GET /api/v1/auth/me', () => {
    it('returns 401 without token', async () => {
      const res = await ctx.request('/api/v1/auth/me')
      expect(res.status).toBe(401)
    })

    it('returns user info with valid session', async () => {
      const { token } = await createUserWithSession(ctx, {
        id: 'u-me',
        role: 'committee',
        firstName: 'Jean',
        lastName: 'President',
      })

      const res = await ctx.request('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.role).toBe('committee')
      expect(body.firstName).toBe('Jean')
    })
  })

  // ── POST /auth/logout ─────────────────────────────────────────────────────

  describe('POST /api/v1/auth/logout', () => {
    it('destroys the session', async () => {
      const { token } = await createUserWithSession(ctx, {
        id: 'u-logout',
        role: 'collaborator',
      })

      const res = await ctx.request('/api/v1/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(200)

      // Token should no longer work
      const meRes = await ctx.request('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(meRes.status).toBe(401)
    })
  })
})
