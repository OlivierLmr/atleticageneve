import { describe, it, expect } from 'vitest'
import {
  athleteRegistrationSchema,
  batchAthleteRegistrationSchema,
  managerRegistrationSchema,
  eventConfigSchema,
} from '@shared/validation'

describe('athleteRegistrationSchema', () => {
  const valid = {
    firstName: 'Marcell',
    lastName: 'Jacobs',
    nationality: 'ITA',
    gender: 'M' as const,
    eventId: '100m-m',
    personalBest: '9.80',
    seasonBest: '9.95',
  }

  it('accepts minimal valid data', () => {
    expect(athleteRegistrationSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts full data with all optional fields', () => {
    const result = athleteRegistrationSchema.safeParse({
      ...valid,
      dateOfBirth: '1994-09-26',
      federation: 'FIDAL',
      isEap: false,
      isSwiss: false,
      distanceFromGva: 880,
      waProfileUrl: 'https://worldathletics.org/athletes/italy/marcell-jacobs-14655484',
      swiLicence: '',
      athleteEmail: 'marcell@example.com',
      athletePhone: '+39123456',
      managerId: 'u-mgr-1',
      worldRanking: 3,
      iRunClean: 'yes',
      dopingFree: 'yes',
      participantNotes: 'Ground floor preferred',
      additionalNotes: 'Arriving from Rome',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing required fields', () => {
    expect(athleteRegistrationSchema.safeParse({}).success).toBe(false)
    expect(athleteRegistrationSchema.safeParse({ firstName: 'X' }).success).toBe(false)
  })

  it('rejects nationality with 1 char', () => {
    expect(athleteRegistrationSchema.safeParse({ ...valid, nationality: 'I' }).success).toBe(false)
  })

  it('rejects nationality with 4+ chars', () => {
    expect(athleteRegistrationSchema.safeParse({ ...valid, nationality: 'ITAL' }).success).toBe(false)
  })
})

describe('batchAthleteRegistrationSchema', () => {
  const validAthlete = {
    firstName: 'Test',
    lastName: 'Runner',
    nationality: 'GBR',
    gender: 'M' as const,
    eventId: '100m-m',
    personalBest: '10.05',
    seasonBest: '10.10',
  }

  it('accepts array of 1+ valid athletes', () => {
    expect(batchAthleteRegistrationSchema.safeParse({ athletes: [validAthlete] }).success).toBe(true)
    expect(batchAthleteRegistrationSchema.safeParse({ athletes: [validAthlete, validAthlete] }).success).toBe(true)
  })

  it('rejects empty array', () => {
    expect(batchAthleteRegistrationSchema.safeParse({ athletes: [] }).success).toBe(false)
  })

  it('rejects if any athlete is invalid', () => {
    expect(batchAthleteRegistrationSchema.safeParse({
      athletes: [validAthlete, { firstName: '' }],
    }).success).toBe(false)
  })
})

describe('managerRegistrationSchema', () => {
  it('accepts valid data', () => {
    expect(managerRegistrationSchema.safeParse({
      firstName: 'John',
      lastName: 'Smith',
      email: 'john@example.com',
      phone: '+1234',
    }).success).toBe(true)
  })

  it('accepts with optional organization', () => {
    expect(managerRegistrationSchema.safeParse({
      firstName: 'John',
      lastName: 'Smith',
      email: 'john@example.com',
      phone: '+1234',
      organization: 'Track Management',
    }).success).toBe(true)
  })

  it('rejects missing email', () => {
    expect(managerRegistrationSchema.safeParse({
      firstName: 'John',
      lastName: 'Smith',
      phone: '+1234',
    }).success).toBe(false)
  })

  it('rejects missing phone', () => {
    expect(managerRegistrationSchema.safeParse({
      firstName: 'John',
      lastName: 'Smith',
      email: 'john@example.com',
    }).success).toBe(false)
  })
})

describe('eventConfigSchema', () => {
  const validEvent = {
    name: '200m Men',
    discipline: 'Sprint',
    gender: 'M' as const,
    perfType: 'MIN' as const,
    maxSlots: 8,
    intMinima: 20.00,
    swissMinima: 20.50,
  }

  it('accepts valid event config', () => {
    expect(eventConfigSchema.safeParse(validEvent).success).toBe(true)
  })

  it('accepts with all optional fields', () => {
    expect(eventConfigSchema.safeParse({
      ...validEvent,
      eapMinima: 20.80,
      meetRecord: '19.95',
      targetPerf: '20.10',
      swissQuota: 2,
      eapQuota: 1,
      prize1st: 5000,
      prize2nd: 3000,
      prize3rd: 1000,
    }).success).toBe(true)
  })

  it('rejects maxSlots < 1', () => {
    expect(eventConfigSchema.safeParse({ ...validEvent, maxSlots: 0 }).success).toBe(false)
  })

  it('rejects negative minima', () => {
    expect(eventConfigSchema.safeParse({ ...validEvent, intMinima: -1 }).success).toBe(false)
  })

  it('rejects invalid perfType', () => {
    expect(eventConfigSchema.safeParse({ ...validEvent, perfType: 'FAST' }).success).toBe(false)
  })

  it('partial schema works for PATCH', () => {
    const partial = eventConfigSchema.partial()
    expect(partial.safeParse({ maxSlots: 10 }).success).toBe(true)
    expect(partial.safeParse({}).success).toBe(true)
  })
})
