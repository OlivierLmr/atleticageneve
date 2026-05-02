import { describe, it, expect } from 'vitest'
import { agreementSchema } from '@shared/validation'
import { calculateTotalCost } from '../../src/api/lib/helpers'

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

// Workflow transition tests are in workflow.test.ts
// Portal/counter-offer tests are in portal.test.ts
