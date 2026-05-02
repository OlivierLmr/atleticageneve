import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema'
import { requireAuth } from '../middleware/auth'
import { hotelRoomSchema, hotelRoomUpdateSchema } from '@shared/validation'
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
app.post('/', requireAuth('committee'), zValidator('json', hotelRoomSchema), async (c) => {
  const db = c.get('db')
  const data = c.req.valid('json')

  const hotels = await db.select().from(schema.hotel).where(eq(schema.hotel.id, data.hotelId)).limit(1)
  if (hotels.length === 0) {
    return c.json({ error: 'Hotel not found' }, 404)
  }

  const id = crypto.randomUUID()
  await db.insert(schema.hotelRoom).values({
    id,
    hotelId: data.hotelId,
    roomType: data.roomType,
    costPerNight: data.costPerNight,
    dinnerCost: data.dinnerCost,
    reservedRooms: data.reservedRooms,
  })

  const created = await db.select().from(schema.hotelRoom).where(eq(schema.hotelRoom.id, id)).limit(1)
  return c.json(created[0], 201)
})

// PATCH /hotel-rooms/:id — committee only
app.patch('/:id', requireAuth('committee'), zValidator('json', hotelRoomUpdateSchema), async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()
  const data = c.req.valid('json')

  const existing = await db.select().from(schema.hotelRoom).where(eq(schema.hotelRoom.id, id)).limit(1)
  if (existing.length === 0) {
    return c.json({ error: 'Hotel room not found' }, 404)
  }

  if (Object.keys(data).length === 0) {
    return c.json({ error: 'No fields to update' }, 400)
  }

  await db.update(schema.hotelRoom).set(data).where(eq(schema.hotelRoom.id, id))
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
