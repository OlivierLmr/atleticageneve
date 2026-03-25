import { describe, it, expect } from 'vitest'
import { DEFAULT_TOTAL_BUDGET } from '@shared/constants'
import type { ApplicationStatus } from '@shared/types'

// ── Dashboard aggregation logic (mirrors dashboard.ts) ───────────────────────

interface MockApp {
  id: string
  eventId: string
  athleteId: string
  status: ApplicationStatus
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
  const confirmed = apps.filter((a) => a.status === 'accepted').length
  const inNegotiation = apps.filter((a) =>
    ['contract_sent', 'counter_offer'].includes(a.status)
  ).length
  const toReview = apps.filter((a) => a.status === 'to_review').length
  const budgetCommitted = apps
    .filter((a) => a.status === 'accepted')
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
  const confirmed = eventApps.filter((a) => a.status === 'accepted')

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
  const accepted = apps.filter((a) => a.status === 'accepted')
  return {
    travel: accepted.reduce((sum, a) => sum + a.estTravel, 0),
    accommodation: accepted.reduce((sum, a) => sum + a.estAccommodation, 0),
    appearance: accepted.reduce((sum, a) => sum + a.estAppearance, 0),
    total: accepted.reduce((sum, a) => sum + a.estTotal, 0),
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

const mockApps: MockApp[] = [
  { id: '1', eventId: '100m-m', athleteId: 'a1', status: 'accepted', estTotal: 15000, estTravel: 2000, estAccommodation: 3000, estAppearance: 10000, assignedSelector: 's1' },
  { id: '2', eventId: '100m-m', athleteId: 'a2', status: 'contract_sent', estTotal: 12000, estTravel: 1500, estAccommodation: 2500, estAppearance: 8000, assignedSelector: 's1' },
  { id: '3', eventId: '100m-f', athleteId: 'a3', status: 'to_review', estTotal: 0, estTravel: 0, estAccommodation: 0, estAppearance: 0, assignedSelector: 's2' },
  { id: '4', eventId: '100m-m', athleteId: 'a4', status: 'accepted', estTotal: 8000, estTravel: 1000, estAccommodation: 2000, estAppearance: 5000, assignedSelector: null },
  { id: '5', eventId: '100m-f', athleteId: 'a5', status: 'rejected', estTotal: 0, estTravel: 0, estAccommodation: 0, estAppearance: 0, assignedSelector: 's2' },
]

const mockAthletes: MockAthlete[] = [
  { id: 'a1', isSwiss: false, isEap: false },
  { id: 'a2', isSwiss: false, isEap: true },
  { id: 'a3', isSwiss: true, isEap: false },
  { id: 'a4', isSwiss: true, isEap: false },
  { id: 'a5', isSwiss: false, isEap: false },
]

describe('dashboard KPI aggregation', () => {
  const kpi = computeKpi(mockApps, DEFAULT_TOTAL_BUDGET)

  it('counts confirmed applications', () => {
    expect(kpi.confirmed).toBe(2)
  })

  it('counts in-negotiation applications', () => {
    expect(kpi.inNegotiation).toBe(1)
  })

  it('counts to-review applications', () => {
    expect(kpi.toReview).toBe(1)
  })

  it('sums budget committed from accepted applications', () => {
    expect(kpi.budgetCommitted).toBe(15000 + 8000)
  })

  it('calculates remaining budget', () => {
    expect(kpi.budgetRemaining).toBe(DEFAULT_TOTAL_BUDGET - 23000)
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
    expect(result.swissConfirmed).toBe(1) // a4 is Swiss + accepted
    expect(result.swissQuotaMet).toBe(true)
  })

  it('tracks EAP quota for 100m-m', () => {
    const result = computeEventFillRate(mockApps, mockAthletes, '100m-m', 8, 1, 1)
    expect(result.eapConfirmed).toBe(0) // a2 is EAP but only contract_sent, not accepted
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

  it('sums travel costs for accepted', () => {
    expect(costs.travel).toBe(2000 + 1000)
  })

  it('sums accommodation costs for accepted', () => {
    expect(costs.accommodation).toBe(3000 + 2000)
  })

  it('sums appearance costs for accepted', () => {
    expect(costs.appearance).toBe(10000 + 5000)
  })

  it('total matches sum of components', () => {
    expect(costs.total).toBe(15000 + 8000)
  })

  it('only counts accepted applications', () => {
    // contract_sent, to_review, rejected should not be included
    expect(costs.total).toBe(23000) // only a1 + a4
  })
})

describe('selector workload', () => {
  function computeSelectorWorkload(apps: MockApp[], selectorId: string) {
    const assigned = apps.filter((a) => a.assignedSelector === selectorId)
    return {
      total: assigned.length,
      toReview: assigned.filter((a) => a.status === 'to_review').length,
      inNegotiation: assigned.filter((a) =>
        ['contract_sent', 'counter_offer'].includes(a.status)
      ).length,
      confirmed: assigned.filter((a) => a.status === 'accepted').length,
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
