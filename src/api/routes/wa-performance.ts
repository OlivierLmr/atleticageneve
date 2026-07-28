import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, and, desc, isNotNull, sql } from 'drizzle-orm'
import * as schema from '../db/schema'
import { waPerformanceSchema } from '@shared/validation'
import { computeScore } from '@shared/scoring'
import { requireAuth } from '../middleware/auth'
import { recalculateAthleteEstimatedCost } from '../services/costEstimation'
import { fetchAndUpsertWaData } from '../services/wa-scraper'
import { perfType, editionWeights } from '../lib/helpers'
import type { Db } from '../lib/helpers'
import type { Env } from '../index'

const waPerformance = new Hono<Env>()

waPerformance.use('*', requireAuth('collaborator', 'committee'))

// ── Shared upsert helper ─────────────────────────────────────────────────────

export async function upsertWaPerformance(
  db: Db,
  data: { athleteId: string; eventId: string; personalBest: number | null; seasonBest: number | null; worldRanking: number | null; eaRanking?: number | null },
): Promise<void> {
  const { athleteId, eventId, personalBest, seasonBest, worldRanking, eaRanking } = data

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
        eaRanking: eaRanking ?? existing[0].eaRanking,
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
      eaRanking: eaRanking ?? null,
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

        const scoreResult = computeScore({
          personalBest: finalPB,
          seasonBest: finalSB,
          worldRanking: finalRanking,
          estimatedCostTotal: effectiveCost,
          isEap: ath.isEap,
          isSwiss: ath.isSwiss,
          perfType: perfType(catalog.discipline),
          intMinima: evt.intMinima,
          swissMinima: evt.swissMinima,
          eapMinima: evt.eapMinima,
        }, editionWeights(edition))

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

waPerformance.post('/', zValidator('json', waPerformanceSchema), async (c) => {
  const db = c.get('db')
  const data = c.req.valid('json')

  await upsertWaPerformance(db, {
    athleteId: data.athleteId,
    eventId: data.eventId,
    personalBest: data.personalBest ?? null,
    seasonBest: data.seasonBest ?? null,
    worldRanking: data.worldRanking ?? null,
    eaRanking: data.eaRanking ?? null,
  })
  return c.json({ success: true })
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

// ── POST /wa-performance/refresh-all — bulk-refresh WA+EA data for every athlete with a profile URL ──
// Queues every athlete with a WA profile URL into a wa_refresh_job. No scraping happens here —
// each athlete is processed one at a time, synchronously, by a GET /refresh-all/:jobId poll (see
// below). This intentionally avoids Cloudflare Workers' waitUntil() for work that can take
// minutes: waitUntil tasks aren't guaranteed to run to completion once detached from the
// triggering request, so a long loop inside one can silently die partway through — which is
// exactly what produced a progress counter that advances and then freezes forever.
//
// Driving the work from the polling requests instead means every processed athlete happens
// inside a real, live HTTP request, and progress is persisted to D1 after each one — so it can
// never get stuck, and naturally paces requests to WA/EA at the poll interval instead of bursting.

waPerformance.post('/refresh-all', async (c) => {
  const db = c.get('db')

  const athletes = await db
    .select({ id: schema.athlete.id })
    .from(schema.athlete)
    .where(isNotNull(schema.athlete.waProfileUrl))

  const athleteIds = athletes.map((a) => a.id)
  const jobId = crypto.randomUUID()
  await db.insert(schema.waRefreshJob).values({
    id: jobId,
    totalCount: athleteIds.length,
    pendingAthleteIds: JSON.stringify(athleteIds),
  })

  return c.json({ jobId, athletesQueued: athleteIds.length })
})

// ── GET /wa-performance/refresh-all/:jobId — poll progress, and process the next queued athlete ──

waPerformance.get('/refresh-all/:jobId', async (c) => {
  const db = c.get('db')
  const { jobId } = c.req.param()

  const [job] = await db
    .select()
    .from(schema.waRefreshJob)
    .where(eq(schema.waRefreshJob.id, jobId))
    .limit(1)

  if (!job) return c.json({ error: 'Job not found' }, 404)

  if (job.finishedAt !== null) {
    return c.json({ totalCount: job.totalCount, completedCount: job.completedCount, done: true })
  }

  const pending: string[] = JSON.parse(job.pendingAthleteIds)
  const [nextAthleteId, ...rest] = pending

  if (nextAthleteId) {
    await fetchAndUpsertWaData(db, nextAthleteId, upsertWaPerformance).catch(() => {})
  }

  const completedCount = job.completedCount + (nextAthleteId ? 1 : 0)
  const done = rest.length === 0

  await db
    .update(schema.waRefreshJob)
    .set({
      completedCount,
      pendingAthleteIds: JSON.stringify(rest),
      finishedAt: done ? sql`(datetime('now'))` : null,
    })
    .where(eq(schema.waRefreshJob.id, jobId))

  return c.json({ totalCount: job.totalCount, completedCount, done })
})

export default waPerformance
