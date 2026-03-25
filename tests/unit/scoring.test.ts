import { describe, it, expect } from 'vitest'
import { parsePerf, computeScore, type ScoringInput } from '@shared/scoring'
import { EVENT_META } from '@shared/constants'

// ── parsePerf ─────────────────────────────────────────────────────────────────

describe('parsePerf', () => {
  it('parses plain seconds', () => {
    expect(parsePerf('9.80')).toBe(9.80)
    expect(parsePerf('44.35')).toBe(44.35)
  })

  it('parses minutes:seconds format', () => {
    expect(parsePerf('3:26.73')).toBeCloseTo(206.73)
    expect(parsePerf('3:30.12')).toBeCloseTo(210.12)
  })

  it('parses field distances with m suffix', () => {
    expect(parsePerf('2.39m')).toBe(2.39)
    expect(parsePerf('7.30m')).toBe(7.30)
  })

  it('handles edge cases', () => {
    expect(parsePerf('0:59.99')).toBeCloseTo(59.99)
    expect(parsePerf('1:00.00')).toBeCloseTo(60.0)
    expect(parsePerf('10.00')).toBe(10.0)
  })
})

// ── computeScore ──────────────────────────────────────────────────────────────

describe('computeScore', () => {
  const makeInput = (overrides: Partial<ScoringInput> = {}): ScoringInput => ({
    eventId: '100m-m',
    personalBest: '9.80',
    seasonBest: '9.95',
    swissMinima: '10.15',
    worldRanking: 3,
    estimatedCostTotal: 17000,
    isEap: false,
    ...overrides,
  })

  it('returns eligible=true when PB meets Swiss minima for MIN events', () => {
    const result = computeScore(makeInput({ personalBest: '10.10' }))
    expect(result.eligible).toBe(true)
  })

  it('returns eligible=false when PB does not meet Swiss minima for MIN events', () => {
    const result = computeScore(makeInput({ personalBest: '10.20' }))
    expect(result.eligible).toBe(false)
  })

  it('returns eligible=true when PB meets Swiss minima for MAX events', () => {
    const result = computeScore(makeInput({
      eventId: 'hj-m',
      personalBest: '2.30m',
      seasonBest: '2.25m',
      swissMinima: '2.25',
    }))
    expect(result.eligible).toBe(true)
  })

  it('returns eligible=false when PB does not meet Swiss minima for MAX events', () => {
    const result = computeScore(makeInput({
      eventId: 'hj-m',
      personalBest: '2.20m',
      seasonBest: '2.15m',
      swissMinima: '2.25',
    }))
    expect(result.eligible).toBe(false)
  })

  it('computes Highly Recommended for top athletes', () => {
    // Marcell Jacobs: PB 9.80, SB 9.95, rank 3, cost 17000
    const result = computeScore(makeInput())
    expect(result.recommendation).toBe('Highly Recommended')
    expect(result.finalScore).toBeGreaterThanOrEqual(0.75)
  })

  it('computes lower recommendation for weak candidates', () => {
    // PB 11.00 on 100m is very slow; rank 200 gives f3=0; cost 25k gives f5=0
    const result = computeScore(makeInput({
      personalBest: '11.00',
      seasonBest: '11.20',
      worldRanking: 200,
      estimatedCostTotal: 25000,
    }))
    // f1 and f2 still have some value (perf > 0 relative to minima), but ranking and cost contribute 0
    expect(result.f3Ranking).toBe(0)
    expect(result.f5Cost).toBe(0)
    expect(result.finalScore).toBeLessThan(0.55) // at most Under Review
    expect(['Under Review', 'Not Recommended']).toContain(result.recommendation)
  })

  it('applies EAP quota bonus', () => {
    const withoutEap = computeScore(makeInput({ isEap: false }))
    const withEap = computeScore(makeInput({ isEap: true }))
    expect(withEap.qQuota).toBe(0.05)
    expect(withEap.finalScore).toBeCloseTo(withoutEap.finalScore + 0.05, 5)
  })

  it('applies beta manual adjustment', () => {
    const base = computeScore(makeInput())
    const adjusted = computeScore(makeInput(), 0.1)
    expect(adjusted.finalScore).toBeCloseTo(Math.min(1, base.finalScore + 0.1), 5)
  })

  it('clamps finalScore to [0, 1]', () => {
    const result = computeScore(makeInput({
      personalBest: '9.00',
      seasonBest: '9.00',
      worldRanking: 1,
      estimatedCostTotal: 0,
      isEap: true,
    }), 0.5)
    expect(result.finalScore).toBe(1)
  })

  it('returns Not Recommended for unknown event', () => {
    const result = computeScore(makeInput({ eventId: 'unknown-event' }))
    expect(result.recommendation).toBe('Not Recommended')
    expect(result.finalScore).toBe(0)
    expect(result.eligible).toBe(false)
  })

  it('correctly weights components (35/25/30/10)', () => {
    const result = computeScore(makeInput())
    const expected = result.f1PB * 0.35 + result.f2SB * 0.25 + result.f3Ranking * 0.30 + result.f5Cost * 0.10
    expect(result.weightedSum).toBeCloseTo(expected, 10)
  })

  it('f3Ranking: rank 1 → 1.0, rank 51 → 0.0', () => {
    const rank1 = computeScore(makeInput({ worldRanking: 1 }))
    expect(rank1.f3Ranking).toBe(1.0)

    const rank51 = computeScore(makeInput({ worldRanking: 51 }))
    expect(rank51.f3Ranking).toBe(0.0)
  })

  it('f5Cost: ≤10k → 1.0, ≥20k → 0.0', () => {
    const cheap = computeScore(makeInput({ estimatedCostTotal: 5000 }))
    expect(cheap.f5Cost).toBe(1.0)

    const expensive = computeScore(makeInput({ estimatedCostTotal: 25000 }))
    expect(expensive.f5Cost).toBe(0.0)
  })
})

// ── EVENT_META ────────────────────────────────────────────────────────────────

describe('EVENT_META', () => {
  it('has metadata for all 7 events', () => {
    const expectedEvents = ['100m-m', '100m-f', '400m-m', '400m-h-f', '1500m-m', 'hj-m', 'lj-f']
    for (const id of expectedEvents) {
      expect(EVENT_META[id]).toBeDefined()
    }
  })

  it('sprint/hurdle events are MIN type', () => {
    expect(EVENT_META['100m-m'].type).toBe('MIN')
    expect(EVENT_META['400m-h-f'].type).toBe('MIN')
  })

  it('jump events are MAX type', () => {
    expect(EVENT_META['hj-m'].type).toBe('MAX')
    expect(EVENT_META['lj-f'].type).toBe('MAX')
  })

  it('international minima are stricter than Swiss minima for MIN events', () => {
    expect(EVENT_META['100m-m'].intMinima).toBeLessThan(EVENT_META['100m-m'].swiMinima)
  })

  it('international minima are stricter than Swiss minima for MAX events', () => {
    expect(EVENT_META['hj-m'].intMinima).toBeGreaterThan(EVENT_META['hj-m'].swiMinima)
  })
})
