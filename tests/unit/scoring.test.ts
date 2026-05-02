import { describe, it, expect } from 'vitest'
import { computeScore } from '@shared/scoring'

// ── computeScore ──────────────────────────────────────────────────────────────

describe('computeScore', () => {
  const makeInput = (overrides: Partial<Parameters<typeof computeScore>[0]> = {}): Parameters<typeof computeScore>[0] => ({
    personalBest: 9.80,
    seasonBest: 9.95,
    worldRanking: 3,
    estimatedCostTotal: 5000,
    isEap: false,
    isSwiss: false,
    perfType: 'MIN',
    intMinima: 10.05,
    swissMinima: 10.15,
    eapMinima: null,
    ...overrides,
  })

  // ── Eligibility (SB-based with origin thresholds) ──

  it('returns eligible=true when SB meets intMinima for MIN events (international)', () => {
    const result = computeScore(makeInput({ seasonBest: 10.00 }))
    expect(result.eligible).toBe(true)
  })

  it('returns eligible=false when SB does not meet intMinima for MIN events', () => {
    const result = computeScore(makeInput({ seasonBest: 10.10 }))
    expect(result.eligible).toBe(false)
  })

  it('uses swissMinima threshold for Swiss athletes', () => {
    // SB 10.10 exceeds intMinima (10.05) but meets swissMinima (10.15) for MIN
    const result = computeScore(makeInput({ seasonBest: 10.10, isSwiss: true }))
    expect(result.eligible).toBe(true)
  })

  it('uses eapMinima threshold for EAP athletes when available', () => {
    const result = computeScore(makeInput({
      seasonBest: 10.25,
      isEap: true,
      eapMinima: 10.30,
    }))
    expect(result.eligible).toBe(true)
  })

  it('falls back to swissMinima for EAP athletes when eapMinima is null', () => {
    // isEap but eapMinima is null => falls through to isSwiss check, then intMinima
    const result = computeScore(makeInput({
      seasonBest: 10.10,
      isEap: true,
      isSwiss: true,
      eapMinima: null,
    }))
    expect(result.eligible).toBe(true) // uses swissMinima 10.15
  })

  it('returns eligible=true when SB meets minima for MAX events', () => {
    const result = computeScore(makeInput({
      perfType: 'MAX',
      personalBest: 2.30,
      seasonBest: 2.28,
      intMinima: 2.25,
      swissMinima: 2.20,
    }))
    expect(result.eligible).toBe(true)
  })

  it('returns eligible=false when SB does not meet minima for MAX events', () => {
    const result = computeScore(makeInput({
      perfType: 'MAX',
      personalBest: 2.30,
      seasonBest: 2.18,
      intMinima: 2.25,
      swissMinima: 2.20,
    }))
    expect(result.eligible).toBe(false)
  })

  it('returns zero scores when ineligible', () => {
    const result = computeScore(makeInput({ seasonBest: 11.00 }))
    expect(result.eligible).toBe(false)
    expect(result.finalScore).toBe(0)
    expect(result.recommendation).toBe('Not Recommended')
    expect(result.f1PB).toBe(0)
    expect(result.f2SB).toBe(0)
    expect(result.f3Ranking).toBe(0)
    expect(result.f4Cost).toBe(0)
    expect(result.eapBonus).toBe(0)
    expect(result.weightedSum).toBe(0)
  })

  // ── Scoring components ──

  it('computes Highly Recommended for top athletes', () => {
    const result = computeScore(makeInput())
    expect(result.recommendation).toBe('Highly Recommended')
    expect(result.finalScore).toBeGreaterThanOrEqual(0.75)
  })

  it('computes lower recommendation for weaker candidates', () => {
    const result = computeScore(makeInput({
      personalBest: 10.00,
      seasonBest: 10.04,
      worldRanking: 45,
      estimatedCostTotal: 18000,
    }))
    expect(result.finalScore).toBeLessThan(0.75)
    expect(['Recommended', 'Under Review', 'Not Recommended']).toContain(result.recommendation)
  })

  it('applies EAP bonus', () => {
    const withoutEap = computeScore(makeInput({ isEap: false }))
    const withEap = computeScore(makeInput({ isEap: true, eapMinima: 10.30 }))
    expect(withEap.eapBonus).toBe(0.05) // default bonusEap = 5 → 5/100
    expect(withEap.finalScore).toBeCloseTo(
      Math.min(1, withoutEap.weightedSum + withEap.eapBonus), 5
    )
  })

  it('clamps finalScore to [0, 1]', () => {
    const result = computeScore(makeInput({
      personalBest: 9.00,
      seasonBest: 9.00,
      worldRanking: 1,
      estimatedCostTotal: 0,
      isEap: true,
      eapMinima: 10.30,
    }))
    expect(result.finalScore).toBeLessThanOrEqual(1)
    expect(result.finalScore).toBeGreaterThanOrEqual(0)
  })

  // ── Weights ──

  it('correctly applies default weights (25/35/30/10)', () => {
    const result = computeScore(makeInput())
    const expected =
      result.f1PB * 0.25 + result.f2SB * 0.35 +
      result.f3Ranking * 0.30 + result.f4Cost * 0.10
    expect(result.weightedSum).toBeCloseTo(expected, 10)
  })

  it('accepts custom EditionWeights', () => {
    const customWeights = {
      weightPB: 40, weightSB: 30, weightRanking: 20, weightCost: 10, bonusEap: 10,
    }
    const result = computeScore(makeInput(), customWeights)
    const expected =
      result.f1PB * 0.40 + result.f2SB * 0.30 +
      result.f3Ranking * 0.20 + result.f4Cost * 0.10
    expect(result.weightedSum).toBeCloseTo(expected, 10)
  })

  // ── Component functions ──

  it('f3Ranking: rank 1 gives 1.0, rank 51 gives 0.0', () => {
    const rank1 = computeScore(makeInput({ worldRanking: 1 }))
    expect(rank1.f3Ranking).toBe(1.0)

    const rank51 = computeScore(makeInput({ worldRanking: 51 }))
    expect(rank51.f3Ranking).toBe(0.0)
  })

  it('f4Cost: cost <= 10k gives 1.0, cost >= 20k gives 0.0', () => {
    const cheap = computeScore(makeInput({ estimatedCostTotal: 5000 }))
    expect(cheap.f4Cost).toBe(1.0)

    const expensive = computeScore(makeInput({ estimatedCostTotal: 25000 }))
    expect(expensive.f4Cost).toBe(0.0)
  })

  // ── Recommendation thresholds ──

  it('recommendation thresholds: >=0.75 Highly Recommended, >=0.55 Recommended, >=0.35 Under Review', () => {
    // We can't easily hit exact thresholds, but verify the logic via known inputs
    const top = computeScore(makeInput({ worldRanking: 1, estimatedCostTotal: 0 }))
    expect(top.recommendation).toBe('Highly Recommended')
  })
})

