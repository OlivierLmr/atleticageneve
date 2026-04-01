import { describe, it, expect } from 'vitest'
import {
  athleteRegistrationSchema,
  batchAthleteRegistrationSchema,
  managerRegistrationSchema,
  eventCreateSchema,
  eventUpdateSchema,
} from '@shared/validation'

describe('athleteRegistrationSchema', () => {
  const valid = {
    firstName: 'Marcell',
    lastName: 'Jacobs',
    nationality: 'ITA',
    gender: 'M' as const,
    athleteEmail: 'marcell@example.com',
    eventIds: ['100m-m'],
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
      athletePhone: '+39123456',
      managerId: 'u-mgr-1',
      iRunClean: true,
      dopingFree: true,
      participantNotes: 'Ground floor preferred',
      additionalNotes: 'Arriving from Rome',
      eapCity: 'Rome',
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

  it('requires athleteEmail', () => {
    const { athleteEmail: _, ...noEmail } = valid
    expect(athleteRegistrationSchema.safeParse(noEmail).success).toBe(false)
  })

  it('requires eventIds with at least one event', () => {
    expect(athleteRegistrationSchema.safeParse({ ...valid, eventIds: [] }).success).toBe(false)
  })

  it('accepts multiple eventIds', () => {
    expect(athleteRegistrationSchema.safeParse({ ...valid, eventIds: ['100m-m', '200m-m'] }).success).toBe(true)
  })
})

describe('batchAthleteRegistrationSchema', () => {
  const validAthlete = {
    firstName: 'Test',
    lastName: 'Runner',
    nationality: 'GBR',
    gender: 'M' as const,
    dateOfBirth: '1995-01-01',
    eventIds: ['100m-m'],
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

describe('eventCreateSchema', () => {
  const validEvent = {
    catalogId: 'cat-100m-m',
    maxSlots: 8,
    intMinima: 10.05,
    swissMinima: 10.15,
  }

  it('accepts valid event create', () => {
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
      prizeMoney3rd: 1000,
    }).success).toBe(true)
  })

  it('rejects maxSlots < 1', () => {
    expect(eventCreateSchema.safeParse({ ...validEvent, maxSlots: 0 }).success).toBe(false)
  })

  it('rejects negative minima', () => {
    expect(eventCreateSchema.safeParse({ ...validEvent, intMinima: -1 }).success).toBe(false)
  })

  it('defaults swissQuota and eapQuota', () => {
    const result = eventCreateSchema.parse(validEvent)
    expect(result.swissQuota).toBe(1)
    expect(result.eapQuota).toBe(1)
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
    expect(eventUpdateSchema.safeParse({
      eapMinima: null,
      meetRecord: null,
      targetPerf: null,
    }).success).toBe(true)
  })
})
