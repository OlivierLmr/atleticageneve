import { describe, it, expect } from 'vitest'
import { NEGOTIATION_TRANSITIONS, ATHLETE_TRANSITIONS } from '@shared/constants'
import { agreementSchema, negotiationStatusChangeSchema } from '@shared/validation'
import { calculateTotalCost } from '../../src/api/lib/helpers'
import type { NegotiationStatus } from '@shared/types'

describe('agreement cost calculation', () => {
  const room: RoomCosts = { costPerNight: 180, dinnerCost: 80 }
  const edition: EditionCosts = {
    stadiumMealCost: 30,
    transportAirportHotelCost: 60,
    transportHotelStadiumCost: 40,
  }

  const base = {
    appearanceFee: 0,
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

  it('returns 0 for an empty agreement', () => {
    expect(calculateTotalCost(base, room, edition)).toBe(0)
  })

  it('sums appearanceFee and transport', () => {
    expect(
      calculateTotalCost({ ...base, appearanceFee: 5000, transport: 1200 }, room, edition)
    ).toBe(6200)
  })

  it('includes other compensation', () => {
    expect(
      calculateTotalCost({ ...base, appearanceFee: 1000, otherCompensation: 500 }, room, edition)
    ).toBe(1500)
  })

  it('adds hotel nights at the room rate', () => {
    const total = calculateTotalCost(
      { ...base, hotelNightThu: true, hotelNightFri: true, hotelNightSat: true },
      room, edition
    )
    expect(total).toBe(3 * 180)
  })

  it('adds dinners at the room dinner rate', () => {
    const total = calculateTotalCost(
      { ...base, dinnerThu: true, dinnerFri: true },
      room, edition
    )
    expect(total).toBe(2 * 80)
  })

  it('adds stadium meals cost', () => {
    const total = calculateTotalCost({ ...base, stadiumMeals: true }, room, edition)
    expect(total).toBe(30)
  })

  it('adds local transport costs', () => {
    const total = calculateTotalCost(
      { ...base, transportAirportHotel: true, transportHotelStadium: true },
      room, edition
    )
    expect(total).toBe(60 + 40)
  })

  it('calculates a realistic full agreement', () => {
    const total = calculateTotalCost(
      {
        appearanceFee: 8000,
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
      room, edition
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
      room, edition
    )
    expect(total).toBe(6 * 180)
  })

  it('handles zero-cost room (no hotel selected)', () => {
    const noRoom = { costPerNight: 0, dinnerCost: 0 }
    const total = calculateTotalCost(
      { ...base, hotelNightFri: true, dinnerFri: true },
      noRoom, edition
    )
    expect(total).toBe(0)
  })
})

describe('agreementSchema validation', () => {
  it('accepts minimal valid agreement (all defaults)', () => {
    expect(agreementSchema.safeParse({}).success).toBe(true)
  })

  it('accepts full agreement', () => {
    expect(
      agreementSchema.safeParse({
        appearanceFee: 5000,
        otherCompensation: 200,
        otherCompensationDesc: 'Pacemaker fee',
        transport: 800,
        transportAirportHotel: true,
        transportHotelStadium: true,
        hotelRoomId: 'room-1',
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

  it('rejects negative appearanceFee', () => {
    expect(agreementSchema.safeParse({ appearanceFee: -100 }).success).toBe(false)
  })

  it('rejects negative transport', () => {
    expect(agreementSchema.safeParse({ transport: -50 }).success).toBe(false)
  })

  it('rejects non-integer appearanceFee', () => {
    expect(agreementSchema.safeParse({ appearanceFee: 100.5 }).success).toBe(false)
  })
})

describe('workflow transitions for agreement flow', () => {
  // Agreement sending is done via the agreement route (POST /agreements),
  // not via a status transition. The status moves implicitly.
  // Athlete-side transitions are in ATHLETE_TRANSITIONS.

  it('agreement_sent allows confirmed (athlete)', () => {
    expect(ATHLETE_TRANSITIONS.agreement_sent).toContain('confirmed')
  })

  it('agreement_sent allows counter_offer_sent (athlete)', () => {
    expect(ATHLETE_TRANSITIONS.agreement_sent).toContain('counter_offer_sent')
  })

  it('counter_offer_sent allows rejected (collaborator)', () => {
    expect(NEGOTIATION_TRANSITIONS.counter_offer_sent).toContain('rejected')
  })

  it('confirmed allows withdrawn (athlete)', () => {
    expect(ATHLETE_TRANSITIONS.confirmed).toContain('withdrawn')
  })

  it('rejected and withdrawn are terminal (base)', () => {
    expect(NEGOTIATION_TRANSITIONS.rejected).toEqual([])
    expect(NEGOTIATION_TRANSITIONS.withdrawn).toEqual([])
  })

  it('negotiationStatusChangeSchema validates all statuses', () => {
    const statuses: NegotiationStatus[] = [
      'to_review', 'agreement_sent', 'counter_offer_sent', 'confirmed', 'rejected', 'withdrawn',
    ]
    for (const status of statuses) {
      expect(negotiationStatusChangeSchema.safeParse({ status }).success).toBe(true)
    }
  })

  it('negotiationStatusChangeSchema rejects invalid status', () => {
    expect(negotiationStatusChangeSchema.safeParse({ status: 'pending' }).success).toBe(false)
    expect(negotiationStatusChangeSchema.safeParse({ status: 'contract_sent' }).success).toBe(false)
    expect(negotiationStatusChangeSchema.safeParse({ status: '' }).success).toBe(false)
    expect(negotiationStatusChangeSchema.safeParse({}).success).toBe(false)
  })
})

// ── Counter-offer flow tests ─────────────────────────────────────────────────

describe('counter-offer workflow', () => {
  it('agreement_sent allows counter_offer_sent (athlete)', () => {
    expect(ATHLETE_TRANSITIONS.agreement_sent).toContain('counter_offer_sent')
  })

  it('counter_offer_sent does not allow direct confirm', () => {
    expect(NEGOTIATION_TRANSITIONS.counter_offer_sent).not.toContain('confirmed')
    expect(ATHLETE_TRANSITIONS.counter_offer_sent).not.toContain('confirmed')
  })

  it('counter_offer_sent allows rejection (collaborator)', () => {
    expect(NEGOTIATION_TRANSITIONS.counter_offer_sent).toContain('rejected')
  })

  it('counter_offer_sent allows withdrawal (athlete)', () => {
    expect(ATHLETE_TRANSITIONS.counter_offer_sent).toContain('withdrawn')
  })
})

// ── Counter-offer validation ─────────────────────────────────────────────────

describe('counter-offer validation', () => {
  it('accepts a valid counter-offer with modified fee', () => {
    const result = agreementSchema.safeParse({
      appearanceFee: 12000,
      transport: 1500,
      hotelNightThu: true,
      hotelNightFri: true,
      hotelNightSat: true,
    })
    expect(result.success).toBe(true)
  })

  it('accepts counter-offer with notes', () => {
    const result = agreementSchema.safeParse({
      appearanceFee: 10000,
      notes: 'Would prefer an additional hotel night on Wednesday',
    })
    expect(result.success).toBe(true)
  })

  it('rejects counter-offer with negative values', () => {
    expect(agreementSchema.safeParse({ appearanceFee: -5000 }).success).toBe(false)
    expect(agreementSchema.safeParse({ transport: -100 }).success).toBe(false)
    expect(agreementSchema.safeParse({ otherCompensation: -50 }).success).toBe(false)
  })
})

// ── Multi-round negotiation ──────────────────────────────────────────────────

describe('multi-round negotiation path', () => {
  it('supports athlete accepting agreement: agreement_sent -> confirmed', () => {
    expect(ATHLETE_TRANSITIONS.agreement_sent).toContain('confirmed')
  })

  it('supports athlete counter-offering then withdrawing', () => {
    expect(ATHLETE_TRANSITIONS.agreement_sent).toContain('counter_offer_sent')
    expect(ATHLETE_TRANSITIONS.counter_offer_sent).toContain('withdrawn')
  })

  it('supports early rejection: to_review -> rejected', () => {
    expect(NEGOTIATION_TRANSITIONS.to_review).toContain('rejected')
  })

  it('supports withdrawal after confirmation: confirmed -> withdrawn (athlete)', () => {
    expect(ATHLETE_TRANSITIONS.confirmed).toContain('withdrawn')
  })
})

// ── Action mapping tests ─────────────────────────────────────────────────────

describe('action to status mapping', () => {
  const actionMap: Record<string, NegotiationStatus> = {
    confirm: 'confirmed',
    reject: 'rejected',
    withdraw: 'withdrawn',
    counter_offer: 'counter_offer_sent',
  }

  it('maps confirm to confirmed', () => {
    expect(actionMap.confirm).toBe('confirmed')
  })

  it('maps reject to rejected', () => {
    expect(actionMap.reject).toBe('rejected')
  })

  it('maps withdraw to withdrawn', () => {
    expect(actionMap.withdraw).toBe('withdrawn')
  })

  it('maps counter_offer to counter_offer_sent', () => {
    expect(actionMap.counter_offer).toBe('counter_offer_sent')
  })
})
