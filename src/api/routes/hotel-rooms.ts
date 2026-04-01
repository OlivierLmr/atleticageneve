import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema'
import { requireAuth } from '../middleware/auth'
import { hotelRoomSchema } from '@shared/validation'
import type { Env } from '../index'

const app = new Hono<Env>()

// GET /hotel-rooms — committee/collaborator
app.get('/', requireAuth('committee', 'collaborator'), async (c) => {
  const db = c.get('db')
  const items = await db
    .select({
      id: schema.hotelRoom.id,
      hotelId: schema.hotelRoom.hotelId,
      roomType: schema.hotelRoom.roomType,
      costPerNight: schema.hotelRoom.costPerNight,
      dinnerCost: schema.hotelRoom.dinnerCost,
      reservedRooms: schema.hotelRoom.reservedRooms,
      hotelName: schema.hotel.name,
    })
    .from(schema.hotelRoom)
    .leftJoin(schema.hotel, eq(schema.hotelRoom.hotelId, schema.hotel.id))
  return c.json(items)
})

// POST /hotel-rooms — committee only
app.post('/', requireAuth('committee'), async (c) => {
  const db = c.get('db')
  const body = await c.req.json()
  const parsed = hotelRoomSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400)
  }

  const hotels = await db.select().from(schema.hotel).where(eq(schema.hotel.id, parsed.data.hotelId)).limit(1)
  if (hotels.length === 0) {
    return c.json({ error: 'Hotel not found' }, 404)
  }

  const id = crypto.randomUUID()
  await db.insert(schema.hotelRoom).values({
    id,
    hotelId: parsed.data.hotelId,
    roomType: parsed.data.roomType,
    costPerNight: parsed.data.costPerNight,
    dinnerCost: parsed.data.dinnerCost,
    reservedRooms: parsed.data.reservedRooms,
  })

  const created = await db.select().from(schema.hotelRoom).where(eq(schema.hotelRoom.id, id)).limit(1)
  return c.json(created[0], 201)
})

// PATCH /hotel-rooms/:id — committee only
app.patch('/:id', requireAuth('committee'), async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()

  const existing = await db.select().from(schema.hotelRoom).where(eq(schema.hotelRoom.id, id)).limit(1)
  if (existing.length === 0) {
    return c.json({ error: 'Hotel room not found' }, 404)
  }

  const body = await c.req.json()
  const updates: Record<string, unknown> = {}
  if (body.roomType !== undefined) updates.roomType = body.roomType
  if (body.costPerNight !== undefined) updates.costPerNight = body.costPerNight
  if (body.dinnerCost !== undefined) updates.dinnerCost = body.dinnerCost
  if (body.reservedRooms !== undefined) updates.reservedRooms = body.reservedRooms

  if (Object.keys(updates).length === 0) {
    return c.json({ error: 'No fields to update' }, 400)
  }

  await db.update(schema.hotelRoom).set(updates).where(eq(schema.hotelRoom.id, id))
  const updated = await db.select().from(schema.hotelRoom).where(eq(schema.hotelRoom.id, id)).limit(1)
  return c.json(updated[0])
})

// DELETE /hotel-rooms/:id — committee only
app.delete('/:id', requireAuth('committee'), async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()

  const existing = await db.select().from(schema.hotelRoom).where(eq(schema.hotelRoom.id, id)).limit(1)
  if (existing.length === 0) {
    return c.json({ error: 'Hotel room not found' }, 404)
  }

  await db.delete(schema.hotelRoom).where(eq(schema.hotelRoom.id, id))
  return c.json({ success: true })
})

export default app
