import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema'
import { managerRegistrationSchema } from '@shared/validation'
import { generateToken, sessionExpiresAt } from '../services/auth'
import { sendMagicLinkEmail } from '../services/email'
import type { Env } from '../index'

const managers = new Hono<Env>()

// ── POST /managers/register — create a new manager account ────────────────────

managers.post('/register', zValidator('json', managerRegistrationSchema), async (c) => {
  const data = c.req.valid('json')
  const db = c.get('db')

  // Check if email already exists
  const existing = await db.select().from(schema.user).where(eq(schema.user.email, data.email)).limit(1)
  if (existing.length > 0) {
    // Send magic link to existing account instead
    const user = existing[0]
    const token = generateToken()
    await db.insert(schema.magicLink).values({
      userId: user.id,
      token,
      expiresAt: sessionExpiresAt(),
    })
    const baseUrl = c.req.header('Origin') ?? 'http://localhost:5173'
    sendMagicLinkEmail(data.email, token, baseUrl, (user.preferredLang as 'en' | 'fr') ?? 'en')
    return c.json({ message: 'Account exists — login link sent', userId: user.id })
  }

  // Create user account with manager role
  const userId = crypto.randomUUID()
  await db.insert(schema.user).values({
    id: userId,
    role: 'manager',
    email: data.email,
    phone: data.phone,
    firstName: data.firstName,
    lastName: data.lastName,
    organization: data.organization ?? null,
  })

  // Create a session so the manager is logged in immediately
  const sessionToken = generateToken()
  await db.insert(schema.session).values({
    userId,
    token: sessionToken,
    expiresAt: sessionExpiresAt(),
  })

  return c.json({
    userId,
    token: sessionToken,
    user: {
      id: userId,
      role: 'manager',
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      preferredLang: 'en',
    },
  }, 201)
})

export default managers
