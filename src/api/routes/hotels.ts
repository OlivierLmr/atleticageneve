import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema'
import { hotelSchema } from '@shared/validation'
import { requireAuth } from '../middleware/auth'
import type { Env } from '../index'

const hotels = new Hono<Env>()

// ── GET /hotels — list hotels for current edition with room sub-items ────────

hotels.get('/', async (c) => {
  const db = c.get('db')

  // Get current edition
  const editions = await db.select().from(schema.edition).limit(1)
  if (editions.length === 0) {
    return c.json([])
  }

  const hotelRows = await db
    .select()
    .from(schema.hotel)
    .where(eq(schema.hotel.editionId, editions[0].id))

  // Include hotel_room sub-items for each hotel
  const results = []
  for (const h of hotelRows) {
    const rooms = await db
      .select()
      .from(schema.hotelRoom)
      .where(eq(schema.hotelRoom.hotelId, h.id))

    results.push({
      ...h,
      rooms,
    })
  }

  return c.json(results)
})

// ── POST /hotels — create hotel (committee only) ────────────────────────────

hotels.post('/', requireAuth('committee'), zValidator('json', hotelSchema), async (c) => {
  const db = c.get('db')
  const data = c.req.valid('json')

  // Get current edition
  const editions = await db.select().from(schema.edition).limit(1)
  if (editions.length === 0) {
    return c.json({ error: 'No edition configured' }, 400)
  }

  const id = crypto.randomUUID()
  await db.insert(schema.hotel).values({
    id,
    editionId: editions[0].id,
    name: data.name,
  })

  return c.json({ id }, 201)
})

// ── PATCH /hotels/:id — update hotel (committee only) ───────────────────────

hotels.patch('/:id', requireAuth('committee'), zValidator('json', hotelSchema), async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')!
  const data = c.req.valid('json')

  const existing = await db.select().from(schema.hotel).where(eq(schema.hotel.id, id)).limit(1)
  if (existing.length === 0) {
    return c.json({ error: 'Hotel not found' }, 404)
  }

  await db.update(schema.hotel).set({ name: data.name }).where(eq(schema.hotel.id, id))

  return c.json({ id })
})

// ── DELETE /hotels/:id — delete hotel (committee only) ──────────────────────

hotels.delete('/:id', requireAuth('committee'), async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')!

  const existing = await db.select().from(schema.hotel).where(eq(schema.hotel.id, id)).limit(1)
  if (existing.length === 0) {
    return c.json({ error: 'Hotel not found' }, 404)
  }

  // Delete associated rooms first
  await db.delete(schema.hotelRoom).where(eq(schema.hotelRoom.hotelId, id))
  await db.delete(schema.hotel).where(eq(schema.hotel.id, id))

  return c.json({ deleted: true })
})

export default hotels
