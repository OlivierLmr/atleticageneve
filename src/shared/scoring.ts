import type { PerfType, Recommendation, ScoreBreakdown } from './types'
import { EVENT_META } from './constants'

// ── Performance parser ────────────────────────────────────────────────────────

/**
 * Convert a performance string to a comparable number.
 * - "3:26.73"  → 206.73  (minutes:seconds → total seconds)
 * - "9.80"     → 9.80    (plain seconds)
 * - "44.35"    → 44.35
 * - "2.39m"    → 2.39    (field distance, strip 'm')
 * - "7.30m"    → 7.30
 */
export function parsePerf(s: string): number {
  const timeMatch = s.match(/^(\d+):(\d+(?:\.\d+)?)$/)
  if (timeMatch) {
    return parseInt(timeMatch[1], 10) * 60 + parseFloat(timeMatch[2])
  }
  if (s.endsWith('m')) {
    return parseFloat(s.slice(0, -1))
  }
  return parseFloat(s)
}

// ── Component scorers ─────────────────────────────────────────────────────────

function perfScore(perf: number, type: PerfType, minima: number): number {
  if (type === 'MIN') {
    // Lower is better: score = 1 at minima, higher for faster times
    return Math.min(1, Math.max(0, 2 - perf / minima))
  } else {
    // Higher is better: score = 1 at minima, higher for longer distances
    return Math.min(1, Math.max(0, 2 * (perf / minima) - 1))
  }
}

// ── Scoring input ─────────────────────────────────────────────────────────────

export interface ScoringInput {
  eventId: string
  personalBest: string
  seasonBest: string
  swissMinima: string
  worldRanking: number
  estimatedCostTotal: number
  isEap: boolean
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function computeScore(input: ScoringInput, beta = 0): ScoreBreakdown {
  const meta = EVENT_META[input.eventId]

  if (!meta) {
    return {
      eligible: false,
      f1PB: 0, f2SB: 0, f3Ranking: 0, f5Cost: 0,
      qQuota: 0, beta,
      weightedSum: 0, finalScore: 0,
      recommendation: 'Not Recommended',
    }
  }

  const pb = parsePerf(input.personalBest)
  const sb = parsePerf(input.seasonBest)
  const swiMinima = parsePerf(input.swissMinima)

  // Eligibility: PB meets at least the Swiss minima
  const eligible =
    meta.type === 'MIN' ? pb <= swiMinima : pb >= swiMinima

  // f1 / f2 — performance vs. international minima
  const f1PB = perfScore(pb, meta.type, meta.intMinima)
  const f2SB = perfScore(sb, meta.type, meta.intMinima)

  // f3 — world ranking (rank 1 → 1.0, rank 51+ → 0.0, linear)
  const f3Ranking = Math.max(0, 1 - (input.worldRanking - 1) / 50)

  // f5 — cost efficiency (≤ 10 000 CHF → 1.0, ≥ 20 000 CHF → 0.0)
  const f5Cost = Math.min(1, Math.max(0, 2 - input.estimatedCostTotal / 10_000))

  // Q — EAP quota bonus
  const qQuota = input.isEap ? 0.05 : 0

  const weightedSum =
    f1PB * 0.35 + f2SB * 0.25 + f3Ranking * 0.30 + f5Cost * 0.10

  const finalScore = Math.min(1, Math.max(0, weightedSum + qQuota + beta))

  const recommendation: Recommendation =
    finalScore >= 0.75 ? 'Highly Recommended' :
    finalScore >= 0.55 ? 'Recommended' :
    finalScore >= 0.35 ? 'Under Review' :
    'Not Recommended'

  return {
    eligible,
    f1PB, f2SB, f3Ranking, f5Cost,
    qQuota, beta,
    weightedSum, finalScore,
    recommendation,
  }
}
