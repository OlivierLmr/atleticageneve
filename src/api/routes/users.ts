import { Hono } from 'hono'
import { eq, or } from 'drizzle-orm'
import * as schema from '../db/schema'
import { requireAuth } from '../middleware/auth'
import type { Env } from '../index'

const users = new Hono<Env>()

users.use('*', requireAuth('collaborator', 'committee'))

// GET /users?role=collaborator,committee — list users by role
users.get('/', async (c) => {
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

export default users
