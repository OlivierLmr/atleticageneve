import type { PerfType, Recommendation, ScoreBreakdown, EditionWeights } from './types'

export interface ScoringInput {
  personalBest: number
  seasonBest: number
  worldRanking: number
  estimatedCostTotal: number
  isEap: boolean
  isSwiss: boolean
  perfType: PerfType
  intMinima: number
  swissMinima: number
  eapMinima: number | null
}

function perfScore(perf: number, perfType: PerfType, minima: number): number {
  if (perfType === 'MIN') {
    return Math.min(1, Math.max(0, 2 - perf / minima))
  } else {
    return Math.min(1, Math.max(0, 2 * (perf / minima) - 1))
  }
}

export const DEFAULT_WEIGHTS: EditionWeights = {
  weightPB: 25, weightSB: 35, weightRanking: 30, weightCost: 10, bonusEap: 5,
}

export function computeScore(input: ScoringInput, weights: EditionWeights = DEFAULT_WEIGHTS): ScoreBreakdown {
  let threshold: number
  if (input.isEap && input.eapMinima != null) {
    threshold = input.eapMinima
  } else if (input.isSwiss) {
    threshold = input.swissMinima
  } else {
    threshold = input.intMinima
  }

  const eligible = input.perfType === 'MIN'
    ? input.seasonBest <= threshold
    : input.seasonBest >= threshold

  if (!eligible) {
    return {
      eligible: false,
      f1PB: 0, f2SB: 0, f3Ranking: 0, f4Cost: 0, eapBonus: 0,
      weightedSum: 0, finalScore: 0,
      recommendation: 'Not Recommended',
    }
  }

  const f1PB = perfScore(input.personalBest, input.perfType, input.intMinima)
  const f2SB = perfScore(input.seasonBest, input.perfType, input.intMinima)
  const f3Ranking = Math.max(0, 1 - (input.worldRanking - 1) / 50)
  const f4Cost = Math.min(1, Math.max(0, 2 - input.estimatedCostTotal / 10_000))

  const w1 = weights.weightPB / 100
  const w2 = weights.weightSB / 100
  const w3 = weights.weightRanking / 100
  const w4 = weights.weightCost / 100
  const eapBonus = input.isEap ? weights.bonusEap / 100 : 0

  const weightedSum = f1PB * w1 + f2SB * w2 + f3Ranking * w3 + f4Cost * w4
  const finalScore = Math.min(1, Math.max(0, weightedSum + eapBonus))

  const recommendation: Recommendation =
    finalScore >= 0.75 ? 'Highly Recommended' :
    finalScore >= 0.55 ? 'Recommended' :
    finalScore >= 0.35 ? 'Under Review' :
    'Not Recommended'

  return {
    eligible, f1PB, f2SB, f3Ranking, f4Cost, eapBonus,
    weightedSum, finalScore, recommendation,
  }
}
