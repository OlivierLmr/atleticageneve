// ── European Athletics Profile Scraper ───────────────────────────────────────
// Fetches an athlete's EA profile page (same numeric ID as their WA profile),
// extracts __NEXT_DATA__ JSON, and parses the European ranking per discipline.

// ── Types ────────────────────────────────────────────────────────────────────

export interface EaDisciplineMapping {
  eaDiscipline: string
  catalogName: string
}

export interface EaScrapedRanking {
  eaDiscipline: string
  catalogName: string
  eaRanking: number
}

export interface EaScrapeResult {
  rankings: EaScrapedRanking[]
}

interface EaRankingEntry {
  discipline: string
  place: number
}

// ── Discipline Name Normalization ────────────────────────────────────────────

/**
 * EA prefixes every discipline with the athlete's gender (e.g. "Women's 400mH"),
 * which is redundant with the gender already stored on the event catalog row.
 * Normalize away that prefix (plus casing/whitespace) so a catalog's `eaDiscipline`
 * can be configured as just "400mH" — matching still works if the prefix was
 * included too, for backward compatibility with existing configurations.
 */
function normalizeDiscipline(discipline: string): string {
  return discipline
    .replace(/^(men's|women's|mixed)\s+/i, '')
    .trim()
    .toLowerCase()
}

// ── WA athlete ID extraction ─────────────────────────────────────────────────

/**
 * Extract the numeric WA athlete ID from a WA profile URL. The EA profile
 * page for the same athlete lives at the same numeric ID:
 * https://www.european-athletics.com/home/historical-data/athletes/{id}
 */
export function extractWaAthleteId(waProfileUrl: string): string | null {
  const match = waProfileUrl.match(/(\d+)\/?$/)
  return match ? match[1] : null
}

// ── __NEXT_DATA__ Extraction ─────────────────────────────────────────────────

/**
 * Fetch an EA profile page and extract the European ranking per discipline.
 * Discipline mappings are built from the event catalog (gender-filtered).
 */
export async function scrapeEaProfile(
  waAthleteId: string,
  mappings: EaDisciplineMapping[],
): Promise<EaScrapeResult> {
  const disciplineMap = new Map(mappings.map(m => [normalizeDiscipline(m.eaDiscipline), m.catalogName]))

  const url = `https://www.european-athletics.com/home/historical-data/athletes/${waAthleteId}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  let html: string
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AtleticaGeneve/1.0)',
      },
    })
    if (!res.ok) throw new Error(`EA returned ${res.status}`)
    html = await res.text()
  } finally {
    clearTimeout(timeout)
  }

  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/)
  if (!match) throw new Error('Could not find __NEXT_DATA__ in EA page')

  const data = JSON.parse(match[1])
  const athleteInfo = data?.props?.pageProps?.athleteInfo
  if (!athleteInfo) throw new Error('No athlete data in EA page')

  const current: EaRankingEntry[] = athleteInfo.europeanRankings?.current ?? []

  const rankings: EaScrapedRanking[] = []
  for (const r of current) {
    const catalogName = disciplineMap.get(normalizeDiscipline(r.discipline))
    if (!catalogName) continue
    rankings.push({ eaDiscipline: r.discipline, catalogName, eaRanking: r.place })
  }

  return { rankings }
}
