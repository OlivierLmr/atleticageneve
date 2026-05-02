import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
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
app.post('/', requireAuth('committee'), zValidator('json', eapCitySchema), async (c) => {
  const db = c.get('db')
  const data = c.req.valid('json')

  const id = crypto.randomUUID()
  await db.insert(schema.eapCity).values({
    id,
    name: data.name,
    countryCode: data.countryCode,
  })

  const created = await db.select().from(schema.eapCity).where(eq(schema.eapCity.id, id)).limit(1)
  return c.json(created[0], 201)
})

// PATCH /eap-cities/:id — committee only
app.patch('/:id', requireAuth('committee'), zValidator('json', eapCitySchema.partial()), async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()
  const data = c.req.valid('json')

  const existing = await db.select().from(schema.eapCity).where(eq(schema.eapCity.id, id)).limit(1)
  if (existing.length === 0) {
    return c.json({ error: 'EAP city not found' }, 404)
  }

  await db.update(schema.eapCity).set(data).where(eq(schema.eapCity.id, id))
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
