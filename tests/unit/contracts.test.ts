import { describe, it, expect } from 'vitest'
import { HOTEL_COST_PER_NIGHT, VALID_TRANSITIONS } from '@shared/constants'
import { contractOfferSchema, statusChangeSchema } from '@shared/validation'
import type { ApplicationStatus } from '@shared/types'

// ── Cost calculation (mirrors the logic in contracts.ts) ─────────────────────

function calculateTotalCost(data: {
  bonus: number
  otherCompensation: number
  transport: number
  catering: number
  hotelNightTue: boolean
  hotelNightWed: boolean
  hotelNightThu: boolean
  hotelNightFri: boolean
  hotelNightSat: boolean
  hotelNightSun: boolean
}, hotelCostPerNight: number): number {
  const nights = [
    data.hotelNightTue, data.hotelNightWed, data.hotelNightThu,
    data.hotelNightFri, data.hotelNightSat, data.hotelNightSun,
  ].filter(Boolean).length
  return data.bonus + data.otherCompensation + data.transport +
    data.catering + (nights * hotelCostPerNight)
}

describe('contract cost calculation', () => {
  const base = {
    bonus: 0,
    otherCompensation: 0,
    transport: 0,
    catering: 0,
    hotelNightTue: false,
    hotelNightWed: false,
    hotelNightThu: false,
    hotelNightFri: false,
    hotelNightSat: false,
    hotelNightSun: false,
  }

  it('returns 0 for an empty contract', () => {
    expect(calculateTotalCost(base, HOTEL_COST_PER_NIGHT)).toBe(0)
  })

  it('sums bonus, transport, catering', () => {
    expect(
      calculateTotalCost({ ...base, bonus: 5000, transport: 1200, catering: 300 }, HOTEL_COST_PER_NIGHT)
    ).toBe(6500)
  })

  it('includes other compensation', () => {
    expect(
      calculateTotalCost({ ...base, bonus: 1000, otherCompensation: 500 }, HOTEL_COST_PER_NIGHT)
    ).toBe(1500)
  })

  it('adds hotel nights at the correct rate', () => {
    const total = calculateTotalCost(
      { ...base, hotelNightThu: true, hotelNightFri: true, hotelNightSat: true },
      HOTEL_COST_PER_NIGHT
    )
    expect(total).toBe(3 * HOTEL_COST_PER_NIGHT)
  })

  it('calculates a realistic full contract', () => {
    const total = calculateTotalCost(
      {
        bonus: 8000,
        otherCompensation: 500,
        transport: 1500,
        catering: 200,
        hotelNightTue: false,
        hotelNightWed: false,
        hotelNightThu: true,
        hotelNightFri: true,
        hotelNightSat: true,
        hotelNightSun: false,
      },
      HOTEL_COST_PER_NIGHT
    )
    expect(total).toBe(8000 + 500 + 1500 + 200 + 3 * HOTEL_COST_PER_NIGHT)
  })

  it('handles all 6 nights', () => {
    const total = calculateTotalCost(
      {
        ...base,
        hotelNightTue: true,
        hotelNightWed: true,
        hotelNightThu: true,
        hotelNightFri: true,
        hotelNightSat: true,
        hotelNightSun: true,
      },
      HOTEL_COST_PER_NIGHT
    )
    expect(total).toBe(6 * HOTEL_COST_PER_NIGHT)
  })
})

describe('contractOfferSchema validation', () => {
  it('accepts minimal valid offer (all defaults)', () => {
    expect(contractOfferSchema.safeParse({}).success).toBe(true)
  })

  it('accepts full offer', () => {
    expect(
      contractOfferSchema.safeParse({
        bonus: 5000,
        otherCompensation: 200,
        transport: 800,
        localTransport: true,
        hotelNightThu: true,
        hotelNightFri: true,
        hotelNightSat: true,
        catering: 100,
        notes: 'Welcome to Geneva!',
      }).success
    ).toBe(true)
  })

  it('rejects negative bonus', () => {
    expect(contractOfferSchema.safeParse({ bonus: -100 }).success).toBe(false)
  })

  it('rejects negative transport', () => {
    expect(contractOfferSchema.safeParse({ transport: -50 }).success).toBe(false)
  })

  it('rejects non-integer bonus', () => {
    expect(contractOfferSchema.safeParse({ bonus: 100.5 }).success).toBe(false)
  })
})

describe('workflow transitions for contract flow', () => {
  it('to_review allows contract_sent', () => {
    expect(VALID_TRANSITIONS.to_review).toContain('contract_sent')
  })

  it('contract_sent allows accepted', () => {
    expect(VALID_TRANSITIONS.contract_sent).toContain('accepted')
  })

  it('contract_sent allows counter_offer', () => {
    expect(VALID_TRANSITIONS.contract_sent).toContain('counter_offer')
  })

  it('counter_offer allows contract_sent (revised offer)', () => {
    expect(VALID_TRANSITIONS.counter_offer).toContain('contract_sent')
  })

  it('accepted only allows withdrawn', () => {
    expect(VALID_TRANSITIONS.accepted).toEqual(['withdrawn'])
  })

  it('rejected and withdrawn are terminal', () => {
    expect(VALID_TRANSITIONS.rejected).toEqual([])
    expect(VALID_TRANSITIONS.withdrawn).toEqual([])
  })

  it('statusChangeSchema validates all statuses', () => {
    const statuses: ApplicationStatus[] = [
      'to_review', 'contract_sent', 'counter_offer', 'accepted', 'rejected', 'withdrawn',
    ]
    for (const status of statuses) {
      expect(statusChangeSchema.safeParse({ status }).success).toBe(true)
    }
  })

  it('statusChangeSchema rejects invalid status', () => {
    expect(statusChangeSchema.safeParse({ status: 'pending' }).success).toBe(false)
    expect(statusChangeSchema.safeParse({ status: '' }).success).toBe(false)
    expect(statusChangeSchema.safeParse({}).success).toBe(false)
  })
})
