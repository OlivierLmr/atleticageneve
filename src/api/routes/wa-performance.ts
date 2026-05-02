import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import * as schema from '../db/schema'
import { waPerformanceSchema } from '@shared/validation'
import { computeScore } from '@shared/scoring'
import { requireAuth } from '../middleware/auth'
import { recalculateAthleteEstimatedCost } from '../services/costEstimation'
import { fetchAndUpsertWaData } from '../services/wa-scraper'
import type { Env } from '../index'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type { PerfType, EditionWeights } from '@shared/types'

type Db = DrizzleD1Database<typeof schema>

const waPerformance = new Hono<Env>()

waPerformance.use('*', requireAuth('collaborator', 'committee'))

// ── Shared upsert helper ─────────────────────────────────────────────────────

export async function upsertWaPerformance(
  db: Db,
  data: { athleteId: string; eventId: string; personalBest: number | null; seasonBest: number | null; worldRanking: number | null },
): Promise<void> {
  const { athleteId, eventId, personalBest, seasonBest, worldRanking } = data

  // Upsert wa_performance row
  const existing = await db
    .select()
    .from(schema.waPerformance)
    .where(and(
      eq(schema.waPerformance.athleteId, athleteId),
      eq(schema.waPerformance.eventId, eventId),
    ))
    .limit(1)

  if (existing.length > 0) {
    await db
      .update(schema.waPerformance)
      .set({
        personalBest: personalBest ?? existing[0].personalBest,
        seasonBest: seasonBest ?? existing[0].seasonBest,
        worldRanking: worldRanking ?? existing[0].worldRanking,
      })
      .where(eq(schema.waPerformance.id, existing[0].id))
  } else {
    await db.insert(schema.waPerformance).values({
      id: crypto.randomUUID(),
      athleteId,
      eventId,
      personalBest: personalBest ?? null,
      seasonBest: seasonBest ?? null,
      worldRanking: worldRanking ?? null,
    })
  }

  // Auto-propagate to application
  const finalPB = personalBest ?? existing?.[0]?.personalBest ?? null
  const finalSB = seasonBest ?? existing?.[0]?.seasonBest ?? null
  const finalRanking = worldRanking ?? existing?.[0]?.worldRanking ?? null

  const appRows = await db
    .select()
    .from(schema.application)
    .where(and(
      eq(schema.application.athleteId, athleteId),
      eq(schema.application.eventId, eventId),
    ))
    .limit(1)

  if (appRows.length > 0) {
    const app = appRows[0]

    await db
      .update(schema.application)
      .set({
        personalBest: finalPB,
        seasonBest: finalSB,
        worldRanking: finalRanking,
      })
      .where(eq(schema.application.id, app.id))

    // Auto-recompute score if we have enough data
    if (finalPB != null && finalSB != null && finalRanking != null) {
      await recalculateAthleteEstimatedCost(db, athleteId)

      const editions = await db.select().from(schema.edition).limit(1)
      const edition = editions[0]

      const eventRows = await db
        .select({
          event: schema.event,
          catalog: schema.eventCatalog,
        })
        .from(schema.event)
        .innerJoin(schema.eventCatalog, eq(schema.event.catalogId, schema.eventCatalog.id))
        .where(eq(schema.event.id, eventId))
        .limit(1)

      const athleteRows = await db
        .select()
        .from(schema.athlete)
        .where(eq(schema.athlete.id, athleteId))
        .limit(1)

      if (eventRows.length > 0 && athleteRows.length > 0 && edition) {
        const evt = eventRows[0].event
        const catalog = eventRows[0].catalog
        const ath = athleteRows[0]

        const latestAgreements = await db
          .select()
          .from(schema.agreement)
          .where(eq(schema.agreement.athleteId, athleteId))
          .orderBy(desc(schema.agreement.version))
          .limit(1)
        const effectiveCost = latestAgreements.length > 0 ? latestAgreements[0].totalCost : ath.estTotal

        const perfType: PerfType = catalog.discipline === 'Course' ? 'MIN' : 'MAX'

        const weights: EditionWeights = {
          weightPB: edition.weightPB,
          weightSB: edition.weightSB,
          weightRanking: edition.weightRanking,
          weightCost: edition.weightCost,
          bonusEap: edition.bonusEap,
        }

        const scoreResult = computeScore({
          personalBest: finalPB,
          seasonBest: finalSB,
          worldRanking: finalRanking,
          estimatedCostTotal: effectiveCost,
          isEap: ath.isEap,
          isSwiss: ath.isSwiss,
          perfType,
          intMinima: evt.intMinima,
          swissMinima: evt.swissMinima,
          eapMinima: evt.eapMinima,
        }, weights)

        await db
          .update(schema.application)
          .set({
            score: scoreResult.finalScore,
            recommendation: scoreResult.recommendation,
          })
          .where(eq(schema.application.id, app.id))
      }
    }
  }
}

// ── GET /wa-performance?athleteId=X — list performances for an athlete ───────

waPerformance.get('/', async (c) => {
  const db = c.get('db')
  const athleteId = c.req.query('athleteId')

  if (!athleteId) {
    return c.json({ error: 'athleteId query parameter is required' }, 400)
  }

  const results = await db
    .select({
      performance: schema.waPerformance,
      event: schema.event,
      catalog: schema.eventCatalog,
    })
    .from(schema.waPerformance)
    .innerJoin(schema.event, eq(schema.waPerformance.eventId, schema.event.id))
    .innerJoin(schema.eventCatalog, eq(schema.event.catalogId, schema.eventCatalog.id))
    .where(eq(schema.waPerformance.athleteId, athleteId))

  return c.json(results.map(r => ({
    ...r.performance,
    event: {
      id: r.event.id,
      name: r.catalog.name,
      discipline: r.catalog.discipline,
      gender: r.catalog.gender,
    },
  })))
})

// ── POST /wa-performance — upsert PB/SB/ranking for athlete+event ────────────

waPerformance.post('/', async (c) => {
  const db = c.get('db')
  const body = await c.req.json()

  const parsed = waPerformanceSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid data', details: parsed.error.flatten() }, 400)
  }

  await upsertWaPerformance(db, {
    athleteId: parsed.data.athleteId,
    eventId: parsed.data.eventId,
    personalBest: parsed.data.personalBest ?? null,
    seasonBest: parsed.data.seasonBest ?? null,
    worldRanking: parsed.data.worldRanking ?? null,
  })
  return c.json({ ok: true })
})

// ── POST /wa-performance/fetch/:athleteId — scrape WA profile + upsert ───────

waPerformance.post('/fetch/:athleteId', async (c) => {
  const db = c.get('db')
  const { athleteId } = c.req.param()

  try {
    const result = await fetchAndUpsertWaData(db, athleteId, upsertWaPerformance)
    return c.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message === 'Athlete not found') return c.json({ error: message }, 404)
    if (message === 'No WA profile URL') return c.json({ error: message }, 400)
    return c.json({ error: message }, 500)
  }
})

export default waPerformance
