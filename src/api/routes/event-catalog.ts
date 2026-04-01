import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema'
import { requireAuth } from '../middleware/auth'
import { eventCatalogSchema } from '@shared/validation'
import type { Env } from '../index'

const app = new Hono<Env>()

// GET /event-catalog — committee/collaborator
app.get('/', requireAuth('committee', 'collaborator'), async (c) => {
  const db = c.get('db')
  const items = await db.select().from(schema.eventCatalog)
  return c.json(items)
})

// POST /event-catalog — committee only
app.post('/', requireAuth('committee'), async (c) => {
  const db = c.get('db')
  const body = await c.req.json()
  const parsed = eventCatalogSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400)
  }

  const id = `${parsed.data.gender}-${parsed.data.name.toLowerCase().replace(/\s+/g, '-')}`

  await db.insert(schema.eventCatalog).values({
    id,
    name: parsed.data.name,
    discipline: parsed.data.discipline,
    gender: parsed.data.gender,
  })

  const created = await db.select().from(schema.eventCatalog).where(eq(schema.eventCatalog.id, id)).limit(1)
  return c.json(created[0], 201)
})

// DELETE /event-catalog/:id — committee only
app.delete('/:id', requireAuth('committee'), async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()

  const existing = await db.select().from(schema.eventCatalog).where(eq(schema.eventCatalog.id, id)).limit(1)
  if (existing.length === 0) {
    return c.json({ error: 'Event catalog entry not found' }, 404)
  }

  await db.delete(schema.eventCatalog).where(eq(schema.eventCatalog.id, id))
  return c.json({ success: true })
})

export default app
