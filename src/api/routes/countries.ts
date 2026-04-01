import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema'
import { requireAuth } from '../middleware/auth'
import { countrySchema } from '@shared/validation'
import type { Env } from '../index'

const app = new Hono<Env>()

// GET /countries — public (needed for registration forms)
app.get('/', async (c) => {
  const db = c.get('db')
  const items = await db.select().from(schema.country)
  return c.json(items)
})

// POST /countries — committee only
app.post('/', requireAuth('committee'), async (c) => {
  const db = c.get('db')
  const body = await c.req.json()
  const parsed = countrySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400)
  }

  await db.insert(schema.country).values({
    code: parsed.data.code,
    name: parsed.data.name,
  })

  const created = await db.select().from(schema.country).where(eq(schema.country.code, parsed.data.code)).limit(1)
  return c.json(created[0], 201)
})

// DELETE /countries/:code — committee only
app.delete('/:code', requireAuth('committee'), async (c) => {
  const db = c.get('db')
  const { code } = c.req.param()

  const existing = await db.select().from(schema.country).where(eq(schema.country.code, code)).limit(1)
  if (existing.length === 0) {
    return c.json({ error: 'Country not found' }, 404)
  }

  await db.delete(schema.country).where(eq(schema.country.code, code))
  return c.json({ success: true })
})

export default app
