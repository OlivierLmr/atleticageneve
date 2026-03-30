import { describe, it, expect } from 'vitest'
import { VALID_TRANSITIONS } from '@shared/constants'
import { contractOfferSchema, statusChangeSchema } from '@shared/validation'
import type { NegotiationStatus } from '@shared/types'

// ── Cost calculation (mirrors the logic in contracts.ts) ─────────────────────
// Now uses configurable costs from edition, not a hardcoded constant

interface EditionCosts {
  hotelCostPerNight: number
  dinnerCostPp: number
  stadiumMealCost: number
  transportAirportHotelCost: number
  transportHotelStadiumCost: number
}

function calculateTotalCost(data: {
  bonus: number
  otherCompensation: number
  transport: number
  transportAirportHotel: boolean
  transportHotelStadium: boolean
  hotelNightTue: boolean
  hotelNightWed: boolean
  hotelNightThu: boolean
  hotelNightFri: boolean
  hotelNightSat: boolean
  hotelNightSun: boolean
  dinnerTue: boolean
  dinnerWed: boolean
  dinnerThu: boolean
  dinnerFri: boolean
  dinnerSat: boolean
  dinnerSun: boolean
  stadiumMeals: boolean
}, costs: EditionCosts): number {
  const nights = [
    data.hotelNightTue, data.hotelNightWed, data.hotelNightThu,
    data.hotelNightFri, data.hotelNightSat, data.hotelNightSun,
  ].filter(Boolean).length
  const dinners = [
    data.dinnerTue, data.dinnerWed, data.dinnerThu,
    data.dinnerFri, data.dinnerSat, data.dinnerSun,
  ].filter(Boolean).length
  return data.bonus + data.otherCompensation + data.transport +
    (nights * costs.hotelCostPerNight) +
    (dinners * costs.dinnerCostPp) +
    (data.stadiumMeals ? costs.stadiumMealCost : 0) +
    (data.transportAirportHotel ? costs.transportAirportHotelCost : 0) +
    (data.transportHotelStadium ? costs.transportHotelStadiumCost : 0)
}

describe('contract cost calculation', () => {
  const costs: EditionCosts = {
    hotelCostPerNight: 180,
    dinnerCostPp: 80,
    stadiumMealCost: 30,
    transportAirportHotelCost: 60,
    transportHotelStadiumCost: 40,
  }

  const base = {
    bonus: 0,
    otherCompensation: 0,
    transport: 0,
    transportAirportHotel: false,
    transportHotelStadium: false,
    hotelNightTue: false,
    hotelNightWed: false,
    hotelNightThu: false,
    hotelNightFri: false,
    hotelNightSat: false,
    hotelNightSun: false,
    dinnerTue: false,
    dinnerWed: false,
    dinnerThu: false,
    dinnerFri: false,
    dinnerSat: false,
    dinnerSun: false,
    stadiumMeals: false,
  }

  it('returns 0 for an empty contract', () => {
    expect(calculateTotalCost(base, costs)).toBe(0)
  })

  it('sums bonus and transport', () => {
    expect(
      calculateTotalCost({ ...base, bonus: 5000, transport: 1200 }, costs)
    ).toBe(6200)
  })

  it('includes other compensation', () => {
    expect(
      calculateTotalCost({ ...base, bonus: 1000, otherCompensation: 500 }, costs)
    ).toBe(1500)
  })

  it('adds hotel nights at the correct rate', () => {
    const total = calculateTotalCost(
      { ...base, hotelNightThu: true, hotelNightFri: true, hotelNightSat: true },
      costs
    )
    expect(total).toBe(3 * 180)
  })

  it('adds dinners at the correct rate', () => {
    const total = calculateTotalCost(
      { ...base, dinnerThu: true, dinnerFri: true },
      costs
    )
    expect(total).toBe(2 * 80)
  })

  it('adds stadium meals cost', () => {
    const total = calculateTotalCost({ ...base, stadiumMeals: true }, costs)
    expect(total).toBe(30)
  })

  it('adds local transport costs', () => {
    const total = calculateTotalCost(
      { ...base, transportAirportHotel: true, transportHotelStadium: true },
      costs
    )
    expect(total).toBe(60 + 40)
  })

  it('calculates a realistic full contract', () => {
    const total = calculateTotalCost(
      {
        bonus: 8000,
        otherCompensation: 500,
        transport: 1500,
        transportAirportHotel: true,
        transportHotelStadium: true,
        hotelNightTue: false,
        hotelNightWed: false,
        hotelNightThu: true,
        hotelNightFri: true,
        hotelNightSat: true,
        hotelNightSun: false,
        dinnerThu: true,
        dinnerFri: true,
        dinnerSat: true,
        dinnerTue: false,
        dinnerWed: false,
        dinnerSun: false,
        stadiumMeals: true,
      },
      costs
    )
    expect(total).toBe(8000 + 500 + 1500 + 3 * 180 + 3 * 80 + 30 + 60 + 40)
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
      costs
    )
    expect(total).toBe(6 * 180)
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
        otherCompensationDesc: 'Pacemaker fee',
        transport: 800,
        transportAirportHotel: true,
        transportHotelStadium: true,
        hotelNightThu: true,
        hotelNightFri: true,
        hotelNightSat: true,
        dinnerThu: true,
        dinnerFri: true,
        stadiumMeals: true,
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
    const statuses: NegotiationStatus[] = [
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
