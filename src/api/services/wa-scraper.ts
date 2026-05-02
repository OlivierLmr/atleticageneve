// ── World Athletics Profile Scraper ──────────────────────────────────────────
// Fetches an athlete's WA profile page, extracts __NEXT_DATA__ JSON,
// and parses PB, SB, and world ranking per discipline.

import { eq } from 'drizzle-orm'
import * as schema from '../db/schema'
import type { Db } from '../lib/helpers'

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
}

// ── Default Seed Data ──────────────────────────────────────���─────────────────

export const DEFAULT_DISCIPLINE_MAPPINGS: DisciplineMapping[] = [
  { waName: '100 Metres', waRankingSlug: '100m', catalogName: '100m' },
  { waName: '200 Metres', waRankingSlug: '200m', catalogName: '200m' },
  { waName: '400 Metres', waRankingSlug: '400m', catalogName: '400m' },
  { waName: '400 Metres Hurdles', waRankingSlug: '400mh', catalogName: '400mH' },
  { waName: '800 Metres', waRankingSlug: '800m', catalogName: '800m' },
  { waName: '1500 Metres', waRankingSlug: '1500m', catalogName: '1500m' },
  { waName: '5000 Metres', waRankingSlug: '5000m', catalogName: '5000m' },
  { waName: 'High Jump', waRankingSlug: 'high-jump', catalogName: 'High Jump' },
  { waName: 'Long Jump', waRankingSlug: 'long-jump', catalogName: 'Long Jump' },
  { waName: 'Pole Vault', waRankingSlug: 'pole-vault', catalogName: 'Pole Vault' },
  { waName: 'Shot Put', waRankingSlug: 'shot-put', catalogName: 'Shot Put' },
]

// Track disciplines use 'Course' (lower is better), field uses 'Concours' (higher is better)
const FIELD_EVENTS = new Set(['High Jump', 'Long Jump', 'Pole Vault', 'Shot Put'])

// ── Mark Parsing ─────────────────────────────────────────────────────────────

/**
 * Parse a WA mark string into a numeric value.
 * - Track events: stored as seconds (e.g. "9.80" → 9.80, "3:26.00" → 206.00)
 * - Field events: stored as centimeters (e.g. "2.35" → 235)
 */
export function parseMark(mark: string, catalogName: string): number | null {
  if (!mark || mark === '') return null

  const isField = FIELD_EVENTS.has(catalogName)

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
 * Discipline mapping is loaded from DB and passed in.
 */
export async function scrapeWaProfile(
  waProfileUrl: string,
  mappings: DisciplineMapping[],
): Promise<WaScrapeResult> {
  // Build lookup maps from DB mappings
  const nameMap = new Map<string, string>() // WA name → catalog name
  const slugMap = new Map<string, string>() // WA ranking slug → catalog name
  for (const m of mappings) {
    nameMap.set(m.waName, m.catalogName)
    if (m.waRankingSlug) slugMap.set(m.waRankingSlug, m.catalogName)
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
    const catalogName = nameMap.get(r.discipline)
    if (!catalogName) continue
    const value = parseMark(r.mark, catalogName)
    if (value != null) {
      ensureEntry(catalogName).personalBest = value
    }
  }

  // Parse season bests
  const sbResults: WaResult[] = competitor.seasonsBests?.results ?? []
  for (const r of sbResults) {
    if (r.indoor || r.notLegal) continue
    const catalogName = nameMap.get(r.discipline)
    if (!catalogName) continue
    const value = parseMark(r.mark, catalogName)
    if (value != null) {
      ensureEntry(catalogName).seasonBest = value
    }
  }

  // Parse world rankings
  const rankings: WaRanking[] = competitor.worldRankings?.current ?? []
  for (const r of rankings) {
    const catalogName = slugMap.get(r.urlSlug)
    if (!catalogName) continue
    ensureEntry(catalogName).worldRanking = r.place
  }

  // Convert map to array
  const performances: WaScrapedPerformance[] = []
  for (const [catalogName, perf] of perfMap) {
    const waDiscipline = [...nameMap.entries()].find(([, v]) => v === catalogName)?.[0] ?? catalogName
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
  upsertFn: (db: Db, data: { athleteId: string; eventId: string; personalBest: number | null; seasonBest: number | null; worldRanking: number | null }) => Promise<void>,
): Promise<{ fetched: number; matched: number; errors: string[] }> {
  const athletes = await db.select().from(schema.athlete).where(eq(schema.athlete.id, athleteId)).limit(1)
  if (athletes.length === 0) throw new Error('Athlete not found')
  const athlete = athletes[0]

  if (!athlete.waProfileUrl) throw new Error('No WA profile URL')

  // Load discipline mappings from DB
  const mappingRows = await db.select().from(schema.waDisciplineMap)
  const mappings: DisciplineMapping[] = mappingRows.map(r => ({
    waName: r.waName,
    waRankingSlug: r.waRankingSlug,
    catalogName: r.catalogName,
  }))

  if (mappings.length === 0) throw new Error('No discipline mappings configured')

  const result = await scrapeWaProfile(athlete.waProfileUrl, mappings)
  const fetched = result.performances.length

  // Load current edition + events + catalogs
  const editions = await db.select().from(schema.edition).limit(1)
  if (editions.length === 0) throw new Error('No edition found')
  const edition = editions[0]

  const events = await db
    .select({ event: schema.event, catalog: schema.eventCatalog })
    .from(schema.event)
    .innerJoin(schema.eventCatalog, eq(schema.event.catalogId, schema.eventCatalog.id))
    .where(eq(schema.event.editionId, edition.id))

  const errors: string[] = []
  let matched = 0

  for (const perf of result.performances) {
    if (!perf.catalogName) {
      errors.push(`Unmapped discipline: ${perf.waDiscipline}`)
      continue
    }

    const eventMatch = events.find(
      e => e.catalog.name === perf.catalogName && e.catalog.gender === athlete.gender
    )

    if (!eventMatch) continue

    try {
      await upsertFn(db, {
        athleteId,
        eventId: eventMatch.event.id,
        personalBest: perf.personalBest,
        seasonBest: perf.seasonBest,
        worldRanking: perf.worldRanking,
      })
      matched++
    } catch (err) {
      errors.push(`Failed to upsert ${perf.catalogName}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { fetched, matched, errors }
}
