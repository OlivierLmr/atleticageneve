import { Hono } from 'hono'
import { eq, or } from 'drizzle-orm'
import * as schema from '../db/schema'
import { requireAuth } from '../middleware/auth'
import { userProfileUpdateSchema } from '@shared/validation'
import { zValidator } from '@hono/zod-validator'
import type { Env } from '../index'

const users = new Hono<Env>()

// GET /users?role=... — list users by role (staff only)
users.get('/', requireAuth('collaborator', 'committee'), async (c) => {
  const db = c.get('db')
  const roleParam = c.req.query('role')

  const validRoles = ['collaborator', 'committee', 'manager']
  const roles = roleParam
    ? roleParam.split(',').filter(r => validRoles.includes(r))
    : validRoles

  const conditions = roles.map(r => eq(schema.user.role, r))
  const rows = await db
    .select({ id: schema.user.id, firstName: schema.user.firstName, lastName: schema.user.lastName, role: schema.user.role })
    .from(schema.user)
    .where(conditions.length === 1 ? conditions[0] : or(...conditions))

  return c.json(rows)
})

// PATCH /users/me — update own profile (manager/athlete: bankIban only)
users.patch('/me', requireAuth('athlete', 'manager', 'collaborator', 'committee'), zValidator('json', userProfileUpdateSchema), async (c) => {
  const db = c.get('db')
  const user = c.get('user')!
  const data = c.req.valid('json')

  await db
    .update(schema.user)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.user.id, user.id))

  return c.json({ id: user.id, updated: Object.keys(data) })
})

// GET /users/me — get own profile
users.get('/me', requireAuth('athlete', 'manager', 'collaborator', 'committee'), async (c) => {
  const db = c.get('db')
  const user = c.get('user')!

  const rows = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.id, user.id))
    .limit(1)

  if (rows.length === 0) return c.json({ error: 'User not found' }, 404)
  const { passwordHash: _, ...safeUser } = rows[0]
  return c.json(safeUser)
})

export default users
