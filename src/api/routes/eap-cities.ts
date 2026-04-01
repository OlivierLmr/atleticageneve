import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema'
import { requireAuth } from '../middleware/auth'
import { eapCitySchema } from '@shared/validation'
import type { Env } from '../index'

const app = new Hono<Env>()

// GET /eap-cities — public (needed for registration forms)
app.get('/', async (c) => {
  const db = c.get('db')
  const items = await db.select().from(schema.eapCity)
  return c.json(items)
})

// POST /eap-cities — committee only
app.post('/', requireAuth('committee'), async (c) => {
  const db = c.get('db')
  const body = await c.req.json()
  const parsed = eapCitySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400)
  }

  const id = crypto.randomUUID()
  await db.insert(schema.eapCity).values({
    id,
    name: parsed.data.name,
    countryCode: parsed.data.countryCode,
  })

  const created = await db.select().from(schema.eapCity).where(eq(schema.eapCity.id, id)).limit(1)
  return c.json(created[0], 201)
})

// PATCH /eap-cities/:id — committee only
app.patch('/:id', requireAuth('committee'), async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()
  const body = await c.req.json()
  const parsed = eapCitySchema.partial().safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400)
  }

  const existing = await db.select().from(schema.eapCity).where(eq(schema.eapCity.id, id)).limit(1)
  if (existing.length === 0) {
    return c.json({ error: 'EAP city not found' }, 404)
  }

  await db.update(schema.eapCity).set(parsed.data).where(eq(schema.eapCity.id, id))
  const updated = await db.select().from(schema.eapCity).where(eq(schema.eapCity.id, id)).limit(1)
  return c.json(updated[0])
})

// DELETE /eap-cities/:id — committee only
app.delete('/:id', requireAuth('committee'), async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()

  const existing = await db.select().from(schema.eapCity).where(eq(schema.eapCity.id, id)).limit(1)
  if (existing.length === 0) {
    return c.json({ error: 'EAP city not found' }, 404)
  }

  await db.delete(schema.eapCity).where(eq(schema.eapCity.id, id))
  return c.json({ success: true })
})

export default app
