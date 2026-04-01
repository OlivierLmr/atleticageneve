import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import * as schema from '../db/schema'
import { waPerformanceSchema } from '@shared/validation'
import { computeScore } from '@shared/scoring'
import { requireAuth } from '../middleware/auth'
import type { Env } from '../index'
import type { PerfType, EditionWeights } from '@shared/types'

const waPerformance = new Hono<Env>()

waPerformance.use('*', requireAuth('collaborator', 'committee'))

// ── GET /wa-performance?athleteId=X — list performances for an athlete ───────

waPerformance.get('/', async (c) => {
  const db = c.get('db')
  const athleteId = c.req.query('athleteId')

  if (!athleteId) {
    return c.json({ error: 'athleteId query parameter is required' }, 400)
  }

  // Join with event + catalog to return event name/discipline
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

  const { athleteId, eventId, personalBest, seasonBest, worldRanking } = parsed.data

  // Check if record exists
  const existing = await db
    .select()
    .from(schema.waPerformance)
    .where(and(
      eq(schema.waPerformance.athleteId, athleteId),
      eq(schema.waPerformance.eventId, eventId),
    ))
    .limit(1)

  let resultId: string

  if (existing.length > 0) {
    await db
      .update(schema.waPerformance)
      .set({
        personalBest: personalBest ?? existing[0].personalBest,
        seasonBest: seasonBest ?? existing[0].seasonBest,
        worldRanking: worldRanking ?? existing[0].worldRanking,
      })
      .where(eq(schema.waPerformance.id, existing[0].id))

    resultId = existing[0].id
  } else {
    resultId = crypto.randomUUID()
    await db.insert(schema.waPerformance).values({
      id: resultId,
      athleteId,
      eventId,
      personalBest: personalBest ?? null,
      seasonBest: seasonBest ?? null,
      worldRanking: worldRanking ?? null,
    })
  }

  // Auto-propagate: copy PB/SB/ranking to matching application
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
      // Get edition weights
      const editions = await db.select().from(schema.edition).limit(1)
      const edition = editions[0]

      // Get event + catalog for minima and discipline
      const eventRows = await db
        .select({
          event: schema.event,
          catalog: schema.eventCatalog,
        })
        .from(schema.event)
        .innerJoin(schema.eventCatalog, eq(schema.event.catalogId, schema.eventCatalog.id))
        .where(eq(schema.event.id, eventId))
        .limit(1)

      // Get athlete data
      const athleteRows = await db
        .select()
        .from(schema.athlete)
        .where(eq(schema.athlete.id, athleteId))
        .limit(1)

      if (eventRows.length > 0 && athleteRows.length > 0 && edition) {
        const evt = eventRows[0].event
        const catalog = eventRows[0].catalog
        const ath = athleteRows[0]

        // Derive perfType from discipline
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
          estimatedCostTotal: ath.estTotal,
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

  return c.json({ id: resultId, updated: existing.length > 0 }, existing.length > 0 ? 200 : 201)
})

export default waPerformance
