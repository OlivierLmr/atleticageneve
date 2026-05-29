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

  // Fetch all rooms in one query
  const allRooms = await db.select().from(schema.hotelRoom)

  // Compute per-room usage from latest agreements per athlete
  const agreementsWithStatus = await db
    .select({
      id: schema.agreement.id,
      athleteId: schema.agreement.athleteId,
      hotelRoomId: schema.agreement.hotelRoomId,
      sentAt: schema.agreement.sentAt,
      negotiationStatus: schema.athlete.negotiationStatus,
    })
    .from(schema.agreement)
    .innerJoin(schema.athlete, eq(schema.agreement.athleteId, schema.athlete.id))

  // Keep only latest agreement per athlete
  const latestPerAthlete = new Map<string, typeof agreementsWithStatus[0]>()
  for (const agr of agreementsWithStatus) {
    const existing = latestPerAthlete.get(agr.athleteId)
    if (!existing || agr.sentAt > existing.sentAt) {
      latestPerAthlete.set(agr.athleteId, agr)
    }
  }

  const negotiatingCount = new Map<string, number>()
  const confirmedCount = new Map<string, number>()
  for (const agr of latestPerAthlete.values()) {
    if (!agr.hotelRoomId) continue
    if (agr.negotiationStatus === 'agreement_sent' || agr.negotiationStatus === 'counter_offer_sent') {
      negotiatingCount.set(agr.hotelRoomId, (negotiatingCount.get(agr.hotelRoomId) ?? 0) + 1)
    } else if (agr.negotiationStatus === 'confirmed') {
      confirmedCount.set(agr.hotelRoomId, (confirmedCount.get(agr.hotelRoomId) ?? 0) + 1)
    }
  }

  // Group rooms by hotel, enriched with usage counts
  const roomsByHotel = new Map<string, (typeof allRooms[0] & { negotiatingCount: number; confirmedCount: number })[]>()
  for (const room of allRooms) {
    const enriched = {
      ...room,
      negotiatingCount: negotiatingCount.get(room.id) ?? 0,
      confirmedCount: confirmedCount.get(room.id) ?? 0,
    }
    const list = roomsByHotel.get(room.hotelId) ?? []
    list.push(enriched)
    roomsByHotel.set(room.hotelId, list)
  }

  return c.json(hotelRows.map(h => ({
    ...h,
    rooms: roomsByHotel.get(h.id) ?? [],
  })))
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

  return c.json({ success: true })
})

export default hotels
