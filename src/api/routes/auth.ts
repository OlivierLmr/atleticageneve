import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, or } from 'drizzle-orm'
import * as schema from '../db/schema'
import { loginSchema, magicLinkRequestSchema, magicLinkVerifySchema } from '@shared/validation'
import { verifyPassword, generateToken, sessionExpiresAt, magicLinkExpiresAt } from '../services/auth'
import { sendMagicLinkEmail } from '../services/email'
import { requireAuth } from '../middleware/auth'
import type { Env } from '../index'

const auth = new Hono<Env>()

// ── POST /auth/login — username/password for collaborators & committee ────────

auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const { username, password } = c.req.valid('json')
  const db = c.get('db')

  const users = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.username, username))
    .limit(1)

  if (users.length === 0) {
    return c.json({ error: 'Invalid username or password' }, 401)
  }

  const user = users[0]
  if (!user.passwordHash || !user.isActive) {
    return c.json({ error: 'Invalid username or password' }, 401)
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    return c.json({ error: 'Invalid username or password' }, 401)
  }

  // Create session
  const token = generateToken()
  await db.insert(schema.session).values({
    userId: user.id,
    token,
    expiresAt: sessionExpiresAt(),
  })

  return c.json({
    token,
    user: {
      id: user.id,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      preferredLang: user.preferredLang,
    },
  })
})

// ── POST /auth/magic-link — send magic link for athletes & managers ───────────

auth.post('/magic-link', zValidator('json', magicLinkRequestSchema), async (c) => {
  const { email } = c.req.valid('json')
  const db = c.get('db')

  const users = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1)

  if (users.length === 0) {
    // Don't reveal whether email exists — always return success
    return c.json({ message: 'If an account exists, a login link has been sent' })
  }

  const user = users[0]
  const token = generateToken()

  await db.insert(schema.magicLink).values({
    userId: user.id,
    token,
    expiresAt: magicLinkExpiresAt(),
  })

  const baseUrl = c.req.header('Origin') ?? 'http://localhost:5173'
  const lang = (user.preferredLang as 'en' | 'fr') ?? 'en'
  sendMagicLinkEmail(email, token, baseUrl, lang)

  return c.json({ message: 'If an account exists, a login link has been sent' })
})

// ── POST /auth/identify — unified login: check if password or magic link ──────

auth.post('/identify', async (c) => {
  const body = await c.req.json() as { identifier?: string }
  const identifier = body.identifier?.trim()
  if (!identifier) {
    return c.json({ error: 'Identifier required' }, 400)
  }

  const db = c.get('db')

  // Look up by email or username
  const users = await db
    .select()
    .from(schema.user)
    .where(or(eq(schema.user.email, identifier), eq(schema.user.username, identifier)))
    .limit(1)

  if (users.length === 0) {
    // Don't reveal whether the account exists
    return c.json({ method: 'magic_link', message: 'If this email is registered, a login link has been sent.' })
  }

  const user = users[0]

  // User has a password → prompt for it
  if (user.passwordHash) {
    return c.json({ method: 'password' })
  }

  // User is athlete/manager → send magic link
  if (user.email) {
    const token = generateToken()
    await db.insert(schema.magicLink).values({
      userId: user.id,
      token,
      expiresAt: magicLinkExpiresAt(),
    })
    const baseUrl = c.req.header('Origin') ?? 'http://localhost:5173'
    const lang = (user.preferredLang as 'en' | 'fr') ?? 'en'
    sendMagicLinkEmail(user.email, token, baseUrl, lang)
  }

  return c.json({ method: 'magic_link', message: 'If this email is registered, a login link has been sent.' })
})

// ── POST /auth/login-with-password — for identified password users ────────────

auth.post('/login-with-password', async (c) => {
  const body = await c.req.json() as { identifier?: string; password?: string }
  const identifier = body.identifier?.trim()
  const password = body.password
  if (!identifier || !password) {
    return c.json({ error: 'Identifier and password required' }, 400)
  }

  const db = c.get('db')

  const users = await db
    .select()
    .from(schema.user)
    .where(or(eq(schema.user.email, identifier), eq(schema.user.username, identifier)))
    .limit(1)

  if (users.length === 0) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const user = users[0]
  if (!user.passwordHash || !user.isActive) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const token = generateToken()
  await db.insert(schema.session).values({
    userId: user.id,
    token,
    expiresAt: sessionExpiresAt(),
  })

  return c.json({
    token,
    user: {
      id: user.id,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      preferredLang: user.preferredLang,
    },
  })
})

// ── POST /auth/verify-magic-link — verify token and create session ────────────

auth.post('/verify-magic-link', zValidator('json', magicLinkVerifySchema), async (c) => {
  const { token: mlToken } = c.req.valid('json')
  const db = c.get('db')

  const links = await db
    .select()
    .from(schema.magicLink)
    .where(eq(schema.magicLink.token, mlToken))
    .limit(1)

  if (links.length === 0) {
    return c.json({ error: 'Invalid or expired link' }, 401)
  }

  const link = links[0]

  if (link.used) {
    return c.json({ error: 'This link has already been used' }, 401)
  }

  if (new Date(link.expiresAt) < new Date()) {
    return c.json({ error: 'This link has expired' }, 401)
  }

  // Mark as used
  await db
    .update(schema.magicLink)
    .set({ used: true })
    .where(eq(schema.magicLink.id, link.id))

  // Get user
  const users = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.id, link.userId))
    .limit(1)

  if (users.length === 0 || !users[0].isActive) {
    return c.json({ error: 'User not found' }, 401)
  }

  const user = users[0]

  // Create session
  const sessionToken = generateToken()
  await db.insert(schema.session).values({
    userId: user.id,
    token: sessionToken,
    expiresAt: sessionExpiresAt(),
  })

  return c.json({
    token: sessionToken,
    user: {
      id: user.id,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      preferredLang: user.preferredLang,
    },
  })
})

// ── POST /auth/logout — destroy session ───────────────────────────────────────

auth.post('/logout', requireAuth(), async (c) => {
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (token) {
    const db = c.get('db')
    await db.delete(schema.session).where(eq(schema.session.token, token))
  }

  return c.json({ message: 'Logged out' })
})

// ── GET /auth/me — get current user info ──────────────────────────────────────

auth.get('/me', requireAuth(), async (c) => {
  const user = c.get('user')!
  return c.json({
    id: user.id,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    organization: user.organization,
    preferredLang: user.preferredLang,
  })
})

export default auth
