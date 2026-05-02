import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
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
app.post('/', requireAuth('committee'), zValidator('json', countrySchema), async (c) => {
  const db = c.get('db')
  const data = c.req.valid('json')

  await db.insert(schema.country).values({
    code: data.code,
    name: data.name,
    distanceFromGva: data.distanceFromGva ?? 0,
  })

  const created = await db.select().from(schema.country).where(eq(schema.country.code, data.code)).limit(1)
  return c.json(created[0], 201)
})

// PATCH /countries/:code — committee only
app.patch('/:code', requireAuth('committee'), zValidator('json', countrySchema.partial()), async (c) => {
  const db = c.get('db')
  const { code } = c.req.param()
  const data = c.req.valid('json')

  const existing = await db.select().from(schema.country).where(eq(schema.country.code, code)).limit(1)
  if (existing.length === 0) {
    return c.json({ error: 'Country not found' }, 404)
  }

  await db.update(schema.country).set(data).where(eq(schema.country.code, code))
  const updated = await db.select().from(schema.country).where(eq(schema.country.code, code)).limit(1)
  return c.json(updated[0])
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
