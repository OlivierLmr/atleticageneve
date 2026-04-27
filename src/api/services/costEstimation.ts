import { eq } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema'

type Db = DrizzleD1Database<typeof schema>

export async function recalculateAthleteEstimatedCost(db: Db, athleteId: string): Promise<void> {
  const athletes = await db.select().from(schema.athlete).where(eq(schema.athlete.id, athleteId)).limit(1)
  if (athletes.length === 0) return
  const ath = athletes[0]
  if (!ath.editionId) return

  const editions = await db.select().from(schema.edition).where(eq(schema.edition.id, ath.editionId)).limit(1)
  if (editions.length === 0) return
  const edition = editions[0]

  // Derive distance from country
  let distanceFromGva = ath.distanceFromGva
  if (ath.nationality) {
    const countries = await db.select().from(schema.country).where(eq(schema.country.code, ath.nationality)).limit(1)
    if (countries.length > 0) {
      distanceFromGva = countries[0].distanceFromGva
    }
  }

  // Best worldRanking across all wa_performance records for this athlete
  const waPerfs = await db.select().from(schema.waPerformance).where(eq(schema.waPerformance.athleteId, athleteId))
  let bestRanking: number | null = null
  for (const wp of waPerfs) {
    if (wp.worldRanking != null && (bestRanking == null || wp.worldRanking < bestRanking)) {
      bestRanking = wp.worldRanking
    }
  }

  const tierConfigs = await db
    .select()
    .from(schema.costTierConfig)
    .where(eq(schema.costTierConfig.editionId, ath.editionId))

  const distConfigs = await db
    .select()
    .from(schema.costDistanceConfig)
    .where(eq(schema.costDistanceConfig.editionId, ath.editionId))

  if (tierConfigs.length === 0 || distConfigs.length === 0) {
    await db.update(schema.athlete).set({
      distanceFromGva,
      estAppearance: 0,
      estTravel: 0,
      estAccommodation: 0,
      estTotal: 0,
    }).where(eq(schema.athlete.id, athleteId))
    return
  }

  // Find base tier: iterate tiers descending, pick first where ranking fits
  const tiersDesc = [...tierConfigs].sort((a, b) => b.tier - a.tier)
  let matchedTier = tiersDesc[tiersDesc.length - 1]  // lowest tier as default
  if (bestRanking != null) {
    for (const tc of tiersDesc) {
      const minOk = tc.rankingMin == null || bestRanking >= tc.rankingMin
      const maxOk = tc.rankingMax == null || bestRanking <= tc.rankingMax
      if (minOk && maxOk) {
        matchedTier = tc
        break
      }
    }
  }

  // Apply manager tier bonus
  if (ath.managerId != null && edition.managerTierBonus > 0) {
    const maxTier = Math.max(...tierConfigs.map(t => t.tier))
    const bonusTierNumber = Math.min(matchedTier.tier + edition.managerTierBonus, maxTier)
    const bonusTier = tierConfigs.find(t => t.tier === bonusTierNumber)
    if (bonusTier) matchedTier = bonusTier
  }

  // Find distance config: sort by distanceMax ascending (null last = catch-all)
  const distsSorted = [...distConfigs].sort((a, b) => {
    if (a.distanceMax == null) return 1
    if (b.distanceMax == null) return -1
    return a.distanceMax - b.distanceMax
  })
  let matchedDist = distsSorted[distsSorted.length - 1]
  for (const dc of distsSorted) {
    if (dc.distanceMax == null || distanceFromGva <= dc.distanceMax) {
      matchedDist = dc
      break
    }
  }

  const estAppearance = matchedTier.appearanceFee
  const estTravel = matchedDist.travelCost
  const estAccommodation = matchedDist.nights * matchedTier.nightlyRate
  const estTotal = estAppearance + estTravel + estAccommodation

  await db.update(schema.athlete).set({
    distanceFromGva,
    estAppearance,
    estTravel,
    estAccommodation,
    estTotal,
  }).where(eq(schema.athlete.id, athleteId))
}

export async function recalculateAllAthletesForEdition(db: Db, editionId: string): Promise<void> {
  const athletes = await db
    .select({ id: schema.athlete.id })
    .from(schema.athlete)
    .where(eq(schema.athlete.editionId, editionId))

  for (const ath of athletes) {
    await recalculateAthleteEstimatedCost(db, ath.id)
  }
}
