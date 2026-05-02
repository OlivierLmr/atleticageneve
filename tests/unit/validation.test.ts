import { describe, it, expect } from 'vitest'
import {
  loginSchema,
  magicLinkRequestSchema,
  magicLinkVerifySchema,
  athleteRegistrationSchema,
  batchAthleteRegistrationSchema,
  managerRegistrationSchema,
  athleteUpdateSchema,
  agreementSchema,
  negotiationStatusChangeSchema,
  participationStatusChangeSchema,
  eventCreateSchema,
  eventUpdateSchema,
  editionConfigSchema,
  eventCatalogSchema,
  countrySchema,
  eapCitySchema,
  hotelRoomSchema,
  waPerformanceSchema,
  hotelSchema,
} from '@shared/validation'

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    const result = loginSchema.safeParse({ username: 'pierre', password: 'secret' })
    expect(result.success).toBe(true)
  })

  it('rejects empty username', () => {
    const result = loginSchema.safeParse({ username: '', password: 'secret' })
    expect(result.success).toBe(false)
  })

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({ username: 'pierre', password: '' })
    expect(result.success).toBe(false)
  })
})

describe('magicLinkRequestSchema', () => {
  it('accepts valid email', () => {
    expect(magicLinkRequestSchema.safeParse({ email: 'test@example.com' }).success).toBe(true)
  })

  it('rejects invalid email', () => {
    expect(magicLinkRequestSchema.safeParse({ email: 'not-an-email' }).success).toBe(false)
  })
})

describe('magicLinkVerifySchema', () => {
  it('accepts valid token', () => {
    expect(magicLinkVerifySchema.safeParse({ token: 'abc123' }).success).toBe(true)
  })

  it('rejects empty token', () => {
    expect(magicLinkVerifySchema.safeParse({ token: '' }).success).toBe(false)
  })
})

describe('athleteRegistrationSchema', () => {
  const validAthlete = {
    firstName: 'Marcell',
    lastName: 'Jacobs',
    nationality: 'ITA',
    gender: 'M' as const,
    athleteEmail: 'marcell@example.com',
    eventIds: ['100m-m'],
  }

  it('accepts valid minimal athlete data', () => {
    expect(athleteRegistrationSchema.safeParse(validAthlete).success).toBe(true)
  })

  it('rejects missing firstName', () => {
    expect(athleteRegistrationSchema.safeParse({ ...validAthlete, firstName: '' }).success).toBe(false)
  })

  it('rejects invalid gender', () => {
    expect(athleteRegistrationSchema.safeParse({ ...validAthlete, gender: 'X' }).success).toBe(false)
  })

  it('rejects invalid nationality (too short)', () => {
    expect(athleteRegistrationSchema.safeParse({ ...validAthlete, nationality: 'I' }).success).toBe(false)
  })

  it('accepts optional fields', () => {
    const result = athleteRegistrationSchema.safeParse({
      ...validAthlete,
      dateOfBirth: '1994-09-26',
      federation: 'FIDAL',
      isEap: true,
      eapCity: 'eap-1',
      iRunClean: true,
      dopingFree: true,
      participantNotes: 'Some notes',
    })
    expect(result.success).toBe(true)
  })

  it('defaults isEap to false', () => {
    const result = athleteRegistrationSchema.parse(validAthlete)
    expect(result.isEap).toBe(false)
  })

  it('defaults iRunClean to unknown', () => {
    const result = athleteRegistrationSchema.parse(validAthlete)
    expect(result.iRunClean).toBe('unknown')
  })

  it('requires athleteEmail', () => {
    const { athleteEmail: _, ...noEmail } = validAthlete
    expect(athleteRegistrationSchema.safeParse(noEmail).success).toBe(false)
  })

  it('requires eventIds array with at least one event', () => {
    expect(athleteRegistrationSchema.safeParse({ ...validAthlete, eventIds: [] }).success).toBe(false)
  })
})

describe('managerRegistrationSchema', () => {
  it('accepts valid manager data', () => {
    expect(managerRegistrationSchema.safeParse({
      firstName: 'Marcello',
      lastName: 'Magnani',
      email: 'm.magnani@test.com',
      phone: '+39 02 1234',
    }).success).toBe(true)
  })

  it('rejects invalid email', () => {
    expect(managerRegistrationSchema.safeParse({
      firstName: 'Marcello',
      lastName: 'Magnani',
      email: 'bad',
      phone: '+39 02 1234',
    }).success).toBe(false)
  })
})

describe('agreementSchema', () => {
  it('accepts valid agreement', () => {
    const result = agreementSchema.safeParse({
      appearanceFee: 15000,
      transport: 1200,
      hotelNightFri: true,
      hotelNightSat: true,
    })
    expect(result.success).toBe(true)
  })

  it('defaults optional fields', () => {
    const result = agreementSchema.parse({})
    expect(result.appearanceFee).toBe(0)
    expect(result.otherCompensation).toBe(0)
    expect(result.transport).toBe(0)
    expect(result.hotelNightTue).toBe(false)
    expect(result.transportAirportHotel).toBe(false)
    expect(result.dinnerTue).toBe(false)
    expect(result.stadiumMeals).toBe(false)
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

  it('accepts full agreement with all fields', () => {
    expect(agreementSchema.safeParse({
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
    }).success).toBe(true)
  })
})

describe('negotiationStatusChangeSchema', () => {
  it('accepts valid statuses', () => {
    for (const status of ['to_review', 'agreement_sent', 'counter_offer_sent', 'confirmed', 'rejected', 'withdrawn']) {
      expect(negotiationStatusChangeSchema.safeParse({ status }).success).toBe(true)
    }
  })

  it('rejects invalid status', () => {
    expect(negotiationStatusChangeSchema.safeParse({ status: 'invalid' }).success).toBe(false)
    expect(negotiationStatusChangeSchema.safeParse({ status: 'contract_sent' }).success).toBe(false)
    expect(negotiationStatusChangeSchema.safeParse({ status: 'accepted' }).success).toBe(false)
  })
})

describe('participationStatusChangeSchema', () => {
  it('accepts valid statuses', () => {
    for (const status of ['pending', 'selected', 'not_selected']) {
      expect(participationStatusChangeSchema.safeParse({ participationStatus: status }).success).toBe(true)
    }
  })

  it('rejects invalid status', () => {
    expect(participationStatusChangeSchema.safeParse({ participationStatus: 'unknown' }).success).toBe(false)
  })
})

describe('eventCreateSchema', () => {
  const validEvent = {
    catalogId: 'cat-1',
    maxSlots: 8,
    intMinima: 10.05,
    swissMinima: 10.15,
  }

  it('accepts valid event', () => {
    expect(eventCreateSchema.safeParse(validEvent).success).toBe(true)
  })

  it('accepts with all optional fields', () => {
    expect(eventCreateSchema.safeParse({
      ...validEvent,
      eapMinima: 10.30,
      meetRecord: 9.58,
      targetPerf: 9.90,
      swissQuota: 2,
      eapQuota: 1,
      prizeMoney1st: 5000,
      prizeMoney2nd: 3000,
    }).success).toBe(true)
  })

  it('rejects maxSlots < 1', () => {
    expect(eventCreateSchema.safeParse({ ...validEvent, maxSlots: 0 }).success).toBe(false)
  })

  it('rejects negative minima', () => {
    expect(eventCreateSchema.safeParse({ ...validEvent, intMinima: -1 }).success).toBe(false)
  })
})

describe('eventUpdateSchema', () => {
  it('accepts partial update', () => {
    expect(eventUpdateSchema.safeParse({ maxSlots: 10 }).success).toBe(true)
  })

  it('accepts empty object', () => {
    expect(eventUpdateSchema.safeParse({}).success).toBe(true)
  })

  it('accepts nullable fields', () => {
    expect(eventUpdateSchema.safeParse({ eapMinima: null, meetRecord: null }).success).toBe(true)
  })
})

describe('editionConfigSchema', () => {
  it('accepts empty object', () => {
    expect(editionConfigSchema.safeParse({}).success).toBe(true)
  })

  it('accepts partial update with valid weights', () => {
    expect(editionConfigSchema.safeParse({
      name: 'Athletissima 2026',
      weightPB: 25,
      weightSB: 35,
      weightRanking: 30,
      weightCost: 10,
    }).success).toBe(true)
  })

  it('rejects weights that do not sum to 100', () => {
    expect(editionConfigSchema.safeParse({
      weightPB: 30,
      weightSB: 30,
      weightRanking: 30,
      weightCost: 30,
    }).success).toBe(false)
  })

  it('uses defaults for unspecified weights in the sum check', () => {
    // Only changing weightPB to 30 => 30 + 35 + 30 + 10 = 105, should fail
    expect(editionConfigSchema.safeParse({ weightPB: 30 }).success).toBe(false)
    // weightPB: 25 => 25 + 35 + 30 + 10 = 100, should pass
    expect(editionConfigSchema.safeParse({ weightPB: 25 }).success).toBe(true)
  })

  it('rejects weight values outside 0-100', () => {
    expect(editionConfigSchema.safeParse({ weightPB: -5 }).success).toBe(false)
    expect(editionConfigSchema.safeParse({ weightPB: 101 }).success).toBe(false)
  })

  it('accepts notificationEmail as valid email', () => {
    expect(editionConfigSchema.safeParse({ notificationEmail: 'a@b.com' }).success).toBe(true)
    expect(editionConfigSchema.safeParse({ notificationEmail: 'bad' }).success).toBe(false)
  })
})

describe('eventCatalogSchema', () => {
  it('accepts valid catalog entry', () => {
    expect(eventCatalogSchema.safeParse({
      name: '100m',
      discipline: 'Course',
      gender: 'M',
    }).success).toBe(true)
  })

  it('rejects invalid discipline', () => {
    expect(eventCatalogSchema.safeParse({
      name: '100m',
      discipline: 'Sprint',
      gender: 'M',
    }).success).toBe(false)
  })

  it('rejects invalid gender', () => {
    expect(eventCatalogSchema.safeParse({
      name: '100m',
      discipline: 'Course',
      gender: 'X',
    }).success).toBe(false)
  })
})

describe('countrySchema', () => {
  it('accepts valid country', () => {
    expect(countrySchema.safeParse({ code: 'CHE', name: 'Switzerland' }).success).toBe(true)
  })

  it('rejects code with wrong length', () => {
    expect(countrySchema.safeParse({ code: 'CH', name: 'Switzerland' }).success).toBe(false)
    expect(countrySchema.safeParse({ code: 'CHEE', name: 'Switzerland' }).success).toBe(false)
  })
})

describe('eapCitySchema', () => {
  it('accepts valid EAP city', () => {
    expect(eapCitySchema.safeParse({ name: 'Annecy', countryCode: 'FRA' }).success).toBe(true)
  })

  it('rejects invalid countryCode length', () => {
    expect(eapCitySchema.safeParse({ name: 'Annecy', countryCode: 'FR' }).success).toBe(false)
  })
})

describe('hotelSchema', () => {
  it('accepts valid hotel', () => {
    expect(hotelSchema.safeParse({ name: 'Grand Hotel' }).success).toBe(true)
  })

  it('rejects empty name', () => {
    expect(hotelSchema.safeParse({ name: '' }).success).toBe(false)
  })
})

describe('hotelRoomSchema', () => {
  it('accepts valid room', () => {
    expect(hotelRoomSchema.safeParse({
      hotelId: 'h-1',
      roomType: 'Single',
      costPerNight: 180,
      dinnerCost: 80,
      reservedRooms: 5,
    }).success).toBe(true)
  })

  it('rejects negative costPerNight', () => {
    expect(hotelRoomSchema.safeParse({
      hotelId: 'h-1',
      roomType: 'Single',
      costPerNight: -10,
      dinnerCost: 80,
      reservedRooms: 5,
    }).success).toBe(false)
  })
})

describe('waPerformanceSchema', () => {
  it('accepts valid performance data', () => {
    expect(waPerformanceSchema.safeParse({
      athleteId: 'a-1',
      eventId: 'e-1',
      personalBest: 9.80,
      seasonBest: 9.95,
      worldRanking: 3,
    }).success).toBe(true)
  })

  it('accepts with only required fields', () => {
    expect(waPerformanceSchema.safeParse({
      athleteId: 'a-1',
      eventId: 'e-1',
    }).success).toBe(true)
  })

  it('rejects worldRanking < 1', () => {
    expect(waPerformanceSchema.safeParse({
      athleteId: 'a-1',
      eventId: 'e-1',
      worldRanking: 0,
    }).success).toBe(false)
  })
})

describe('athleteUpdateSchema', () => {
  it('accepts empty object (no-op update)', () => {
    expect(athleteUpdateSchema.safeParse({}).success).toBe(true)
  })

  it('accepts partial fields', () => {
    expect(athleteUpdateSchema.safeParse({
      firstName: 'Updated',
      iRunClean: 'yes',
    }).success).toBe(true)
  })

  it('accepts nullable fields set to null', () => {
    expect(athleteUpdateSchema.safeParse({
      dateOfBirth: null,
      federation: null,
      arrivalDate: null,
    }).success).toBe(true)
  })

  it('rejects invalid iRunClean value', () => {
    expect(athleteUpdateSchema.safeParse({ iRunClean: 'maybe' }).success).toBe(false)
  })

  it('rejects invalid paymentStatus', () => {
    expect(athleteUpdateSchema.safeParse({ paymentStatus: 'partial' }).success).toBe(false)
  })

  it('accepts valid paymentMethod', () => {
    for (const method of ['cash', 'bank', 'western_union', 'paypal', 'other']) {
      expect(athleteUpdateSchema.safeParse({ paymentMethod: method }).success).toBe(true)
    }
  })
})
