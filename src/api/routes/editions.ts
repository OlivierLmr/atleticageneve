import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema'
import { requireAuth } from '../middleware/auth'
import { editionConfigSchema, costTierConfigsSchema, costDistanceConfigsSchema } from '@shared/validation'
import { recalculateAllAthletesForEdition } from '../services/costEstimation'
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
  if (data.managerTierBonus !== undefined) updates.managerTierBonus = data.managerTierBonus

  if (Object.keys(updates).length === 0) {
    return c.json({ error: 'No fields to update' }, 400)
  }

  updates.updatedAt = new Date().toISOString()

  await db.update(schema.edition).set(updates).where(eq(schema.edition.id, id))

  const updated = await db.select().from(schema.edition).where(eq(schema.edition.id, id)).limit(1)
  return c.json(updated[0])
})

// GET /editions/:id/cost-configs — return tier and distance configs for an edition (committee only)
app.get('/:id/cost-configs', requireAuth('committee'), async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()

  const tierConfigs = await db
    .select()
    .from(schema.costTierConfig)
    .where(eq(schema.costTierConfig.editionId, id))

  const distanceConfigs = await db
    .select()
    .from(schema.costDistanceConfig)
    .where(eq(schema.costDistanceConfig.editionId, id))

  return c.json({
    tierConfigs: tierConfigs.sort((a, b) => a.tier - b.tier),
    distanceConfigs: distanceConfigs.sort((a, b) => {
      if (a.distanceMax == null) return 1
      if (b.distanceMax == null) return -1
      return a.distanceMax - b.distanceMax
    }),
  })
})

// PUT /editions/:id/cost-tier-configs — replace all tier configs (committee only)
app.put('/:id/cost-tier-configs', requireAuth('committee'), async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()

  const editions = await db.select().from(schema.edition).where(eq(schema.edition.id, id)).limit(1)
  if (editions.length === 0) {
    return c.json({ error: 'Edition not found' }, 404)
  }

  const body = await c.req.json()
  const parsed = costTierConfigsSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400)
  }

  // Replace all tier configs for this edition
  await db.delete(schema.costTierConfig).where(eq(schema.costTierConfig.editionId, id))
  for (const config of parsed.data) {
    await db.insert(schema.costTierConfig).values({
      id: crypto.randomUUID(),
      editionId: id,
      tier: config.tier,
      rankingMin: config.rankingMin ?? null,
      rankingMax: config.rankingMax ?? null,
      appearanceFee: config.appearanceFee,
      nightlyRate: config.nightlyRate,
    })
  }

  // Recalculate estimated costs for all athletes in this edition
  await recalculateAllAthletesForEdition(db, id)

  const tierConfigs = await db
    .select()
    .from(schema.costTierConfig)
    .where(eq(schema.costTierConfig.editionId, id))

  return c.json(tierConfigs.sort((a, b) => a.tier - b.tier))
})

// PUT /editions/:id/cost-distance-configs — replace all distance configs (committee only)
app.put('/:id/cost-distance-configs', requireAuth('committee'), async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()

  const editions = await db.select().from(schema.edition).where(eq(schema.edition.id, id)).limit(1)
  if (editions.length === 0) {
    return c.json({ error: 'Edition not found' }, 404)
  }

  const body = await c.req.json()
  const parsed = costDistanceConfigsSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400)
  }

  // Replace all distance configs for this edition
  await db.delete(schema.costDistanceConfig).where(eq(schema.costDistanceConfig.editionId, id))
  for (const config of parsed.data) {
    await db.insert(schema.costDistanceConfig).values({
      id: crypto.randomUUID(),
      editionId: id,
      distanceMax: config.distanceMax ?? null,
      travelCost: config.travelCost,
      nights: config.nights,
    })
  }

  // Recalculate estimated costs for all athletes in this edition
  await recalculateAllAthletesForEdition(db, id)

  const distanceConfigs = await db
    .select()
    .from(schema.costDistanceConfig)
    .where(eq(schema.costDistanceConfig.editionId, id))

  return c.json(distanceConfigs.sort((a, b) => {
    if (a.distanceMax == null) return 1
    if (b.distanceMax == null) return -1
    return a.distanceMax - b.distanceMax
  }))
})

export default app
