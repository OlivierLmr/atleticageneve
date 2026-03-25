import { describe, it, expect } from 'vitest'
import {
  loginSchema,
  magicLinkRequestSchema,
  athleteRegistrationSchema,
  contractOfferSchema,
  statusChangeSchema,
  logisticsUpdateSchema,
  managerRegistrationSchema,
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
    const result = magicLinkRequestSchema.safeParse({ email: 'test@example.com' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = magicLinkRequestSchema.safeParse({ email: 'not-an-email' })
    expect(result.success).toBe(false)
  })
})

describe('athleteRegistrationSchema', () => {
  const validAthlete = {
    firstName: 'Marcell',
    lastName: 'Jacobs',
    nationality: 'ITA',
    gender: 'M' as const,
    eventId: '100m-m',
    personalBest: '9.80',
    seasonBest: '9.95',
  }

  it('accepts valid minimal athlete data', () => {
    const result = athleteRegistrationSchema.safeParse(validAthlete)
    expect(result.success).toBe(true)
  })

  it('rejects missing firstName', () => {
    const result = athleteRegistrationSchema.safeParse({ ...validAthlete, firstName: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid gender', () => {
    const result = athleteRegistrationSchema.safeParse({ ...validAthlete, gender: 'X' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid nationality (too short)', () => {
    const result = athleteRegistrationSchema.safeParse({ ...validAthlete, nationality: 'I' })
    expect(result.success).toBe(false)
  })

  it('accepts optional fields', () => {
    const result = athleteRegistrationSchema.safeParse({
      ...validAthlete,
      dateOfBirth: '1994-09-26',
      federation: 'FIDAL',
      isEap: true,
      worldRanking: 3,
      iRunClean: 'yes',
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
})

describe('managerRegistrationSchema', () => {
  it('accepts valid manager data', () => {
    const result = managerRegistrationSchema.safeParse({
      firstName: 'Marcello',
      lastName: 'Magnani',
      email: 'm.magnani@test.com',
      phone: '+39 02 1234',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = managerRegistrationSchema.safeParse({
      firstName: 'Marcello',
      lastName: 'Magnani',
      email: 'bad',
      phone: '+39 02 1234',
    })
    expect(result.success).toBe(false)
  })
})

describe('contractOfferSchema', () => {
  it('accepts valid offer', () => {
    const result = contractOfferSchema.safeParse({
      bonus: 15000,
      transport: 1200,
      hotelNightFri: true,
      hotelNightSat: true,
      catering: 300,
    })
    expect(result.success).toBe(true)
  })

  it('defaults optional fields', () => {
    const result = contractOfferSchema.parse({})
    expect(result.bonus).toBe(0)
    expect(result.transport).toBe(0)
    expect(result.catering).toBe(0)
    expect(result.hotelNightTue).toBe(false)
    expect(result.localTransport).toBe(false)
  })

  it('rejects negative bonus', () => {
    const result = contractOfferSchema.safeParse({ bonus: -100 })
    expect(result.success).toBe(false)
  })
})

describe('statusChangeSchema', () => {
  it('accepts valid statuses', () => {
    for (const status of ['to_review', 'contract_sent', 'counter_offer', 'accepted', 'rejected', 'withdrawn']) {
      const result = statusChangeSchema.safeParse({ status })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid status', () => {
    const result = statusChangeSchema.safeParse({ status: 'invalid' })
    expect(result.success).toBe(false)
  })
})

describe('logisticsUpdateSchema', () => {
  it('accepts full logistics', () => {
    const result = logisticsUpdateSchema.safeParse({
      arrivalDate: '2026-06-13',
      arrivalFlight: 'LX 1234',
      arrivalFrom: 'Rome FCO',
      arrivalTime: '14:30',
      departureDate: '2026-06-16',
      departureFlight: 'LX 5678',
      departureTo: 'Rome FCO',
      departureTime: '11:00',
      accommodationReqs: 'Ground floor preferred',
    })
    expect(result.success).toBe(true)
  })

  it('accepts null values', () => {
    const result = logisticsUpdateSchema.safeParse({
      arrivalDate: null,
      arrivalFlight: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty object', () => {
    const result = logisticsUpdateSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})
