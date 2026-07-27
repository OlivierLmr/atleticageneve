// ── World Athletics Profile Scraper ──────────────────────────────────────────
// Fetches an athlete's WA profile page, extracts __NEXT_DATA__ JSON,
// and parses PB, SB, and world ranking per discipline.

import { and, eq, isNotNull } from 'drizzle-orm'
import * as schema from '../db/schema'
import type { Db } from '../lib/helpers'
import { scrapeEaProfile, extractWaAthleteId } from './ea-scraper'
import type { EaDisciplineMapping } from './ea-scraper'

// ── Types ────────────────────────────────────────────────────────────────────

export interface WaScrapedPerformance {
  waDiscipline: string
  catalogName: string | null
  personalBest: number | null
  seasonBest: number | null
  worldRanking: number | null
}

export interface WaScrapeResult {
  performances: WaScrapedPerformance[]
  athleteName: string | null
}

export interface DisciplineMapping {
  waName: string
  waRankingSlug: string | null
  catalogName: string
  isField: boolean
}

// ── Mark Parsing ─────────────────────────────────────────────────────────────

/**
 * Parse a WA mark string into a numeric value.
 * - Track events (isField=false): stored as seconds (e.g. "9.80" → 9.80, "3:26.00" → 206.00)
 * - Field events (isField=true): stored as centimeters (e.g. "2.35" → 235)
 */
export function parseMark(mark: string, isField: boolean): number | null {
  if (!mark || mark === '') return null

  // Handle mm:ss.cc format (e.g. "3:26.00")
  const colonMatch = mark.match(/^(\d+):(\d+(?:\.\d+)?)$/)
  if (colonMatch) {
    const minutes = parseInt(colonMatch[1], 10)
    const seconds = parseFloat(colonMatch[2])
    return parseFloat((minutes * 60 + seconds).toFixed(2))
  }

  const value = parseFloat(mark)
  if (isNaN(value)) return null

  if (isField) {
    return Math.round(value * 100)
  }

  return value
}

// ── __NEXT_DATA__ Extraction ─────────────────────────────────────────────────

interface WaResult {
  discipline: string
  mark: string
  notLegal: boolean
  indoor: boolean
}

interface WaRanking {
  eventGroup: string
  urlSlug: string
  place: number
}

/**
 * Fetch a WA profile page and extract structured performance data.
 * Discipline mappings are built from the event catalog (gender-filtered).
 */
export async function scrapeWaProfile(
  waProfileUrl: string,
  mappings: DisciplineMapping[],
): Promise<WaScrapeResult> {
  // Build lookup maps from mappings
  const nameMap = new Map<string, { catalogName: string; isField: boolean }>()
  const slugMap = new Map<string, { catalogName: string; isField: boolean }>()
  for (const m of mappings) {
    nameMap.set(m.waName, { catalogName: m.catalogName, isField: m.isField })
    if (m.waRankingSlug) slugMap.set(m.waRankingSlug, { catalogName: m.catalogName, isField: m.isField })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  let html: string
  try {
    const res = await fetch(waProfileUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AtleticaGeneve/1.0)',
      },
    })
    if (!res.ok) throw new Error(`WA returned ${res.status}`)
    html = await res.text()
  } finally {
    clearTimeout(timeout)
  }

  // Extract __NEXT_DATA__ JSON
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/)
  if (!match) throw new Error('Could not find __NEXT_DATA__ in WA page')

  const data = JSON.parse(match[1])
  const competitor = data?.props?.pageProps?.competitor
  if (!competitor) throw new Error('No competitor data in WA page')

  const bd = competitor.basicData
  const athleteName = bd?.givenName && bd?.familyName
    ? `${bd.givenName} ${bd.familyName}`
    : bd?.firstName && bd?.lastName
      ? `${bd.firstName} ${bd.lastName}`
      : null

  // Build a map: catalogName → { pb, sb, ranking }
  const perfMap = new Map<string, { personalBest: number | null; seasonBest: number | null; worldRanking: number | null }>()

  const ensureEntry = (catalogName: string) => {
    if (!perfMap.has(catalogName)) {
      perfMap.set(catalogName, { personalBest: null, seasonBest: null, worldRanking: null })
    }
    return perfMap.get(catalogName)!
  }

  // Parse personal bests
  const pbResults: WaResult[] = competitor.personalBests?.results ?? []
  for (const r of pbResults) {
    if (r.indoor || r.notLegal) continue
    const info = nameMap.get(r.discipline)
    if (!info) continue
    const value = parseMark(r.mark, info.isField)
    if (value != null) {
      ensureEntry(info.catalogName).personalBest = value
    }
  }

  // Parse season bests
  const sbResults: WaResult[] = competitor.seasonsBests?.results ?? []
  for (const r of sbResults) {
    if (r.indoor || r.notLegal) continue
    const info = nameMap.get(r.discipline)
    if (!info) continue
    const value = parseMark(r.mark, info.isField)
    if (value != null) {
      ensureEntry(info.catalogName).seasonBest = value
    }
  }

  // Parse world rankings
  const rankings: WaRanking[] = competitor.worldRankings?.current ?? []
  for (const r of rankings) {
    const info = slugMap.get(r.urlSlug)
    if (!info) continue
    ensureEntry(info.catalogName).worldRanking = r.place
  }

  // Convert map to array
  const performances: WaScrapedPerformance[] = []
  for (const [catalogName, perf] of perfMap) {
    const waDiscipline = [...nameMap.entries()].find(([, v]) => v.catalogName === catalogName)?.[0] ?? catalogName
    performances.push({
      waDiscipline,
      catalogName,
      ...perf,
    })
  }

  return { performances, athleteName }
}

// ── Fetch + Upsert Orchestrator ──────────────────────────────────────────────

export async function fetchAndUpsertWaData(
  db: Db,
  athleteId: string,
  upsertFn: (db: Db, data: { athleteId: string; eventId: string; personalBest: number | null; seasonBest: number | null; worldRanking: number | null; eaRanking: number | null }) => Promise<void>,
): Promise<{ fetched: number; matched: number; errors: string[] }> {
  const athletes = await db.select().from(schema.athlete).where(eq(schema.athlete.id, athleteId)).limit(1)
  if (athletes.length === 0) throw new Error('Athlete not found')
  const athlete = athletes[0]

  if (!athlete.waProfileUrl) throw new Error('No WA profile URL')

  // Load discipline mappings from event catalog, filtered by athlete gender
  const catalogRows = await db
    .select()
    .from(schema.eventCatalog)
    .where(and(isNotNull(schema.eventCatalog.waName), eq(schema.eventCatalog.gender, athlete.gender)))

  const mappings: DisciplineMapping[] = catalogRows.map(r => ({
    waName: r.waName!,
    waRankingSlug: r.waRankingSlug ?? null,
    catalogName: r.name,
    isField: r.discipline === 'Concours',
  }))

  if (mappings.length === 0) throw new Error('No WA discipline mappings configured in event catalog')

  const result = await scrapeWaProfile(athlete.waProfileUrl, mappings)
  const fetched = result.performances.length

  const errors: string[] = []

  // EA ranking uses the same numeric ID as the WA profile — best-effort,
  // failures here don't block the WA data that was already fetched.
  const eaRankingByCatalog = new Map<string, number>()
  const waAthleteId = extractWaAthleteId(athlete.waProfileUrl)
  if (waAthleteId) {
    const eaCatalogRows = await db
      .select()
      .from(schema.eventCatalog)
      .where(and(isNotNull(schema.eventCatalog.eaDiscipline), eq(schema.eventCatalog.gender, athlete.gender)))

    const eaMappings: EaDisciplineMapping[] = eaCatalogRows.map(r => ({
      eaDiscipline: r.eaDiscipline!,
      catalogName: r.name,
    }))

    if (eaMappings.length > 0) {
      try {
        const eaResult = await scrapeEaProfile(waAthleteId, eaMappings)
        for (const r of eaResult.rankings) {
          eaRankingByCatalog.set(r.catalogName, r.eaRanking)
        }
        if (eaResult.rankings.length === 0) {
          errors.push('EA profile fetched but no ranking matched a configured EA discipline — check the "Discipline EA" mapping in the event catalog')
        }
      } catch (err) {
        errors.push(`EA fetch failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    } else {
      errors.push('No EA discipline mappings configured in the event catalog — set "Discipline EA" for this athlete\'s events to enable EA ranking fetch')
    }
  }

  // Load current edition + events + catalogs
  const editions = await db.select().from(schema.edition).limit(1)
  if (editions.length === 0) throw new Error('No edition found')
  const edition = editions[0]

  const events = await db
    .select({ event: schema.event, catalog: schema.eventCatalog })
    .from(schema.event)
    .innerJoin(schema.eventCatalog, eq(schema.event.catalogId, schema.eventCatalog.id))
    .where(eq(schema.event.editionId, edition.id))

  let matched = 0

  for (const perf of result.performances) {
    if (!perf.catalogName) {
      errors.push(`Unmapped discipline: ${perf.waDiscipline}`)
      continue
    }

    // Catalog names are already gender-specific (loaded per athlete gender above)
    const eventMatch = events.find(e => e.catalog.name === perf.catalogName)

    if (!eventMatch) continue

    try {
      await upsertFn(db, {
        athleteId,
        eventId: eventMatch.event.id,
        personalBest: perf.personalBest,
        seasonBest: perf.seasonBest,
        worldRanking: perf.worldRanking,
        eaRanking: eaRankingByCatalog.get(perf.catalogName) ?? null,
      })
      matched++
      eaRankingByCatalog.delete(perf.catalogName)
    } catch (err) {
      errors.push(`Failed to upsert ${perf.catalogName}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Disciplines with an EA ranking but no WA PB/SB/ranking data still get upserted
  for (const [catalogName, eaRanking] of eaRankingByCatalog) {
    const eventMatch = events.find(e => e.catalog.name === catalogName)
    if (!eventMatch) continue

    try {
      await upsertFn(db, {
        athleteId,
        eventId: eventMatch.event.id,
        personalBest: null,
        seasonBest: null,
        worldRanking: null,
        eaRanking,
      })
      matched++
    } catch (err) {
      errors.push(`Failed to upsert ${catalogName}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { fetched, matched, errors }
}
