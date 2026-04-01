import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema'
import { requireAuth } from '../middleware/auth'
import { editionConfigSchema } from '@shared/validation'
import type { Env } from '../index'

const app = new Hono<Env>()

// GET /editions/current — public
app.get('/current', async (c) => {
  const db = c.get('db')
  const editions = await db.select().from(schema.edition).limit(1)
  if (editions.length === 0) {
    return c.json({ error: 'No edition configured' }, 404)
  }
  return c.json(editions[0])
})

// PATCH /editions/:id — committee only
app.patch('/:id', requireAuth('committee'), async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()

  const body = await c.req.json()
  const parsed = editionConfigSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400)
  }

  const editions = await db.select().from(schema.edition).where(eq(schema.edition.id, id)).limit(1)
  if (editions.length === 0) {
    return c.json({ error: 'Edition not found' }, 404)
  }

  const data = parsed.data
  const updates: Record<string, unknown> = {}

  if (data.name !== undefined) updates.name = data.name
  if (data.year !== undefined) updates.year = data.year
  if (data.startDate !== undefined) updates.startDate = data.startDate
  if (data.endDate !== undefined) updates.endDate = data.endDate
  if (data.currency !== undefined) updates.currency = data.currency
  if (data.totalBudget !== undefined) updates.totalBudget = data.totalBudget
  if (data.stadiumMealCost !== undefined) updates.stadiumMealCost = data.stadiumMealCost
  if (data.transportAirportHotelCost !== undefined) updates.transportAirportHotelCost = data.transportAirportHotelCost
  if (data.transportHotelStadiumCost !== undefined) updates.transportHotelStadiumCost = data.transportHotelStadiumCost
  if (data.notificationEmail !== undefined) updates.notificationEmail = data.notificationEmail
  if (data.weightPB !== undefined) updates.weightPB = data.weightPB
  if (data.weightSB !== undefined) updates.weightSB = data.weightSB
  if (data.weightRanking !== undefined) updates.weightRanking = data.weightRanking
  if (data.weightCost !== undefined) updates.weightCost = data.weightCost
  if (data.bonusEap !== undefined) updates.bonusEap = data.bonusEap

  if (Object.keys(updates).length === 0) {
    return c.json({ error: 'No fields to update' }, 400)
  }

  updates.updatedAt = new Date().toISOString()

  await db.update(schema.edition).set(updates).where(eq(schema.edition.id, id))

  const updated = await db.select().from(schema.edition).where(eq(schema.edition.id, id)).limit(1)
  return c.json(updated[0])
})

export default app
