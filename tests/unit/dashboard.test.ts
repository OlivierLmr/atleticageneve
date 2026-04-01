import { describe, it, expect } from 'vitest'
import type { NegotiationStatus } from '@shared/types'

// ── Dashboard aggregation logic (mirrors dashboard.ts) ───────────────────────

interface MockApp {
  id: string
  eventId: string
  athleteId: string
  negotiationStatus: NegotiationStatus
  estTotal: number
  estTravel: number
  estAccommodation: number
  estAppearance: number
  assignedSelector: string | null
}

interface MockAthlete {
  id: string
  isSwiss: boolean
  isEap: boolean
}

function computeKpi(apps: MockApp[], totalBudget: number) {
  const confirmed = apps.filter((a) => a.negotiationStatus === 'confirmed').length
  const inNegotiation = apps.filter((a) =>
    ['agreement_sent', 'counter_offer_sent'].includes(a.negotiationStatus)
  ).length
  const toReview = apps.filter((a) => a.negotiationStatus === 'to_review').length
  const budgetCommitted = apps
    .filter((a) => a.negotiationStatus === 'confirmed')
    .reduce((sum, a) => sum + a.estTotal, 0)
  const budgetRemaining = totalBudget - budgetCommitted

  return { confirmed, inNegotiation, toReview, budgetCommitted, budgetRemaining }
}

function computeEventFillRate(
  apps: MockApp[],
  athletes: MockAthlete[],
  eventId: string,
  maxSlots: number,
  swissQuota: number,
  eapQuota: number
) {
  const eventApps = apps.filter((a) => a.eventId === eventId)
  const confirmed = eventApps.filter((a) => a.negotiationStatus === 'confirmed')

  const swissConfirmed = confirmed.filter((a) => {
    const ath = athletes.find((at) => at.id === a.athleteId)
    return ath?.isSwiss
  }).length

  const eapConfirmed = confirmed.filter((a) => {
    const ath = athletes.find((at) => at.id === a.athleteId)
    return ath?.isEap
  }).length

  return {
    confirmed: confirmed.length,
    fillRate: maxSlots > 0 ? confirmed.length / maxSlots : 0,
    swissConfirmed,
    eapConfirmed,
    swissQuotaMet: swissConfirmed >= swissQuota,
    eapQuotaMet: eapConfirmed >= eapQuota,
  }
}

function computeCostBreakdown(apps: MockApp[]) {
  const confirmed = apps.filter((a) => a.negotiationStatus === 'confirmed')
  return {
    travel: confirmed.reduce((sum, a) => sum + a.estTravel, 0),
    accommodation: confirmed.reduce((sum, a) => sum + a.estAccommodation, 0),
    appearance: confirmed.reduce((sum, a) => sum + a.estAppearance, 0),
    total: confirmed.reduce((sum, a) => sum + a.estTotal, 0),
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

const TOTAL_BUDGET = 250_000

const mockApps: MockApp[] = [
  { id: '1', eventId: '100m-m', athleteId: 'a1', negotiationStatus: 'confirmed', estTotal: 15000, estTravel: 2000, estAccommodation: 3000, estAppearance: 10000, assignedSelector: 's1' },
  { id: '2', eventId: '100m-m', athleteId: 'a2', negotiationStatus: 'agreement_sent', estTotal: 12000, estTravel: 1500, estAccommodation: 2500, estAppearance: 8000, assignedSelector: 's1' },
  { id: '3', eventId: '100m-f', athleteId: 'a3', negotiationStatus: 'to_review', estTotal: 0, estTravel: 0, estAccommodation: 0, estAppearance: 0, assignedSelector: 's2' },
  { id: '4', eventId: '100m-m', athleteId: 'a4', negotiationStatus: 'confirmed', estTotal: 8000, estTravel: 1000, estAccommodation: 2000, estAppearance: 5000, assignedSelector: null },
  { id: '5', eventId: '100m-f', athleteId: 'a5', negotiationStatus: 'rejected', estTotal: 0, estTravel: 0, estAccommodation: 0, estAppearance: 0, assignedSelector: 's2' },
]

const mockAthletes: MockAthlete[] = [
  { id: 'a1', isSwiss: false, isEap: false },
  { id: 'a2', isSwiss: false, isEap: true },
  { id: 'a3', isSwiss: true, isEap: false },
  { id: 'a4', isSwiss: true, isEap: false },
  { id: 'a5', isSwiss: false, isEap: false },
]

describe('dashboard KPI aggregation', () => {
  const kpi = computeKpi(mockApps, TOTAL_BUDGET)

  it('counts confirmed applications', () => {
    expect(kpi.confirmed).toBe(2)
  })

  it('counts in-negotiation applications', () => {
    expect(kpi.inNegotiation).toBe(1)
  })

  it('counts to-review applications', () => {
    expect(kpi.toReview).toBe(1)
  })

  it('sums budget committed from confirmed applications', () => {
    expect(kpi.budgetCommitted).toBe(15000 + 8000)
  })

  it('calculates remaining budget', () => {
    expect(kpi.budgetRemaining).toBe(TOTAL_BUDGET - 23000)
  })
})

describe('event fill rate', () => {
  it('calculates fill rate for 100m-m', () => {
    const result = computeEventFillRate(mockApps, mockAthletes, '100m-m', 8, 1, 1)
    expect(result.confirmed).toBe(2)
    expect(result.fillRate).toBe(2 / 8)
  })

  it('tracks Swiss quota for 100m-m', () => {
    const result = computeEventFillRate(mockApps, mockAthletes, '100m-m', 8, 1, 1)
    expect(result.swissConfirmed).toBe(1) // a4 is Swiss + confirmed
    expect(result.swissQuotaMet).toBe(true)
  })

  it('tracks EAP quota for 100m-m', () => {
    const result = computeEventFillRate(mockApps, mockAthletes, '100m-m', 8, 1, 1)
    expect(result.eapConfirmed).toBe(0) // a2 is EAP but only agreement_sent, not confirmed
    expect(result.eapQuotaMet).toBe(false)
  })

  it('returns 0 fill rate when no confirmed', () => {
    const result = computeEventFillRate(mockApps, mockAthletes, '100m-f', 8, 1, 1)
    expect(result.confirmed).toBe(0)
    expect(result.fillRate).toBe(0)
  })

  it('handles 0 maxSlots', () => {
    const result = computeEventFillRate(mockApps, mockAthletes, '100m-m', 0, 1, 1)
    expect(result.fillRate).toBe(0)
  })
})

describe('cost breakdown', () => {
  const costs = computeCostBreakdown(mockApps)

  it('sums travel costs for confirmed', () => {
    expect(costs.travel).toBe(2000 + 1000)
  })

  it('sums accommodation costs for confirmed', () => {
    expect(costs.accommodation).toBe(3000 + 2000)
  })

  it('sums appearance costs for confirmed', () => {
    expect(costs.appearance).toBe(10000 + 5000)
  })

  it('total matches sum of components', () => {
    expect(costs.total).toBe(15000 + 8000)
  })

  it('only counts confirmed applications', () => {
    expect(costs.total).toBe(23000) // only a1 + a4
  })
})

describe('selector workload', () => {
  function computeSelectorWorkload(apps: MockApp[], selectorId: string) {
    const assigned = apps.filter((a) => a.assignedSelector === selectorId)
    return {
      total: assigned.length,
      toReview: assigned.filter((a) => a.negotiationStatus === 'to_review').length,
      inNegotiation: assigned.filter((a) =>
        ['agreement_sent', 'counter_offer_sent'].includes(a.negotiationStatus)
      ).length,
      confirmed: assigned.filter((a) => a.negotiationStatus === 'confirmed').length,
    }
  }

  it('computes workload for selector s1', () => {
    const workload = computeSelectorWorkload(mockApps, 's1')
    expect(workload.total).toBe(2)
    expect(workload.confirmed).toBe(1)
    expect(workload.inNegotiation).toBe(1)
  })

  it('computes workload for selector s2', () => {
    const workload = computeSelectorWorkload(mockApps, 's2')
    expect(workload.total).toBe(2)
    expect(workload.toReview).toBe(1)
  })
})
