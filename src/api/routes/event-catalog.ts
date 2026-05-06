import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
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
app.post('/', requireAuth('committee'), zValidator('json', eventCatalogSchema), async (c) => {
  const db = c.get('db')
  const data = c.req.valid('json')

  const id = `${data.gender}-${data.name.toLowerCase().replace(/\s+/g, '-')}`

  await db.insert(schema.eventCatalog).values({
    id,
    name: data.name,
    discipline: data.discipline,
    gender: data.gender,
    waName: data.waName ?? null,
    waRankingSlug: data.waRankingSlug ?? null,
  })

  const created = await db.select().from(schema.eventCatalog).where(eq(schema.eventCatalog.id, id)).limit(1)
  return c.json(created[0], 201)
})

// PATCH /event-catalog/:id — committee only
app.patch('/:id', requireAuth('committee'), zValidator('json', eventCatalogSchema.partial()), async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()
  const data = c.req.valid('json')

  const existing = await db.select().from(schema.eventCatalog).where(eq(schema.eventCatalog.id, id)).limit(1)
  if (existing.length === 0) {
    return c.json({ error: 'Event catalog entry not found' }, 404)
  }

  await db.update(schema.eventCatalog).set(data).where(eq(schema.eventCatalog.id, id))
  const updated = await db.select().from(schema.eventCatalog).where(eq(schema.eventCatalog.id, id)).limit(1)
  return c.json(updated[0])
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
