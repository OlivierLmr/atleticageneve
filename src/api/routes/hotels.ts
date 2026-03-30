import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema'
import type { Env } from '../index'

const hotels = new Hono<Env>()

// ── GET /hotels — list hotels for current edition ────────────────────────────

hotels.get('/', async (c) => {
  const db = c.get('db')

  // Get current edition
  const editions = await db.select().from(schema.edition).limit(1)
  if (editions.length === 0) {
    return c.json([])
  }

  const results = await db
    .select()
    .from(schema.hotel)
    .where(eq(schema.hotel.editionId, editions[0].id))

  return c.json(results)
})

export default hotels
