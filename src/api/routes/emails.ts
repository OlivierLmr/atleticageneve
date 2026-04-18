import { Hono } from 'hono'
import { desc, eq } from 'drizzle-orm'
import * as schema from '../db/schema'
import { requireAuth } from '../middleware/auth'
import type { Env } from '../index'

const app = new Hono<Env>()

// GET /emails — public (dev email viewer on home page)
app.get('/', async (c) => {
  const db = c.get('db')
  const limit = parseInt(c.req.query('limit') || '100', 10)
  const offset = parseInt(c.req.query('offset') || '0', 10)

  const items = await db
    .select()
    .from(schema.emailLog)
    .orderBy(desc(schema.emailLog.sentAt))
    .limit(limit)
    .offset(offset)

  return c.json(items)
})

// GET /emails/athlete/:athleteId — emails for a specific athlete
app.get('/athlete/:athleteId', requireAuth('committee', 'collaborator'), async (c) => {
  const db = c.get('db')
  const { athleteId } = c.req.param()

  const items = await db
    .select()
    .from(schema.emailLog)
    .where(eq(schema.emailLog.relatedAthleteId, athleteId))
    .orderBy(desc(schema.emailLog.sentAt))

  return c.json(items)
})

// GET /emails/:id — single email by ID (all authenticated roles)
app.get('/:id', requireAuth('collaborator', 'committee', 'athlete', 'manager'), async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()

  const [email] = await db
    .select()
    .from(schema.emailLog)
    .where(eq(schema.emailLog.id, id))
    .limit(1)

  if (!email) return c.json({ error: 'Email not found' }, 404)
  return c.json(email)
})

export default app
