import { describe, it, expect } from 'vitest'
import { NEGOTIATION_TRANSITIONS, COMMITTEE_EXTRA_TRANSITIONS, ATHLETE_TRANSITIONS, PARTICIPATION_TRANSITIONS } from '@shared/constants'
import type { NegotiationStatus, ParticipationStatus } from '@shared/types'

describe('Negotiation workflow transitions', () => {
  // Base collaborator transitions
  function canTransition(from: NegotiationStatus, to: NegotiationStatus): boolean {
    return NEGOTIATION_TRANSITIONS[from]?.includes(to) ?? false
  }

  // Athlete/manager transitions
  function canAthleteTransition(from: NegotiationStatus, to: NegotiationStatus): boolean {
    return ATHLETE_TRANSITIONS[from]?.includes(to) ?? false
  }

  // Committee extra transitions
  function canCommitteeTransition(from: NegotiationStatus, to: NegotiationStatus): boolean {
    return COMMITTEE_EXTRA_TRANSITIONS[from]?.includes(to) ?? false
  }

  // Base collaborator transitions
  it('to_review -> rejected is valid (collaborator)', () => {
    expect(canTransition('to_review', 'rejected')).toBe(true)
  })

  it('counter_offer_sent -> rejected is valid (collaborator)', () => {
    expect(canTransition('counter_offer_sent', 'rejected')).toBe(true)
  })

  // Athlete transitions
  it('to_review -> withdrawn is valid (athlete)', () => {
    expect(canAthleteTransition('to_review', 'withdrawn')).toBe(true)
  })

  it('agreement_sent -> confirmed is valid (athlete)', () => {
    expect(canAthleteTransition('agreement_sent', 'confirmed')).toBe(true)
  })

  it('agreement_sent -> counter_offer_sent is valid (athlete)', () => {
    expect(canAthleteTransition('agreement_sent', 'counter_offer_sent')).toBe(true)
  })

  it('agreement_sent -> withdrawn is valid (athlete)', () => {
    expect(canAthleteTransition('agreement_sent', 'withdrawn')).toBe(true)
  })

  it('confirmed -> withdrawn is valid (athlete)', () => {
    expect(canAthleteTransition('confirmed', 'withdrawn')).toBe(true)
  })

  // Committee extra transitions
  it('confirmed -> rejected is valid (committee override)', () => {
    expect(canCommitteeTransition('confirmed', 'rejected')).toBe(true)
  })

  it('rejected -> to_review is valid (committee reopen)', () => {
    expect(canCommitteeTransition('rejected', 'to_review')).toBe(true)
  })

  it('withdrawn -> to_review is valid (committee reopen)', () => {
    expect(canCommitteeTransition('withdrawn', 'to_review')).toBe(true)
  })

  // Invalid transitions
  it('to_review -> confirmed is invalid (must send agreement first)', () => {
    expect(canTransition('to_review', 'confirmed')).toBe(false)
    expect(canAthleteTransition('to_review', 'confirmed')).toBe(false)
  })

  it('counter_offer_sent -> confirmed is invalid (org must re-send agreement)', () => {
    expect(canTransition('counter_offer_sent', 'confirmed')).toBe(false)
    expect(canAthleteTransition('counter_offer_sent', 'confirmed')).toBe(false)
  })

  it('rejected is terminal for base transitions', () => {
    const allStatuses: NegotiationStatus[] = ['to_review', 'agreement_sent', 'counter_offer_sent', 'confirmed', 'withdrawn']
    for (const status of allStatuses) {
      expect(canTransition('rejected', status)).toBe(false)
    }
  })

  it('withdrawn is terminal for base transitions', () => {
    const allStatuses: NegotiationStatus[] = ['to_review', 'agreement_sent', 'counter_offer_sent', 'confirmed', 'rejected']
    for (const status of allStatuses) {
      expect(canTransition('withdrawn', status)).toBe(false)
    }
  })
})

describe('Participation workflow transitions', () => {
  function canTransition(from: ParticipationStatus, to: ParticipationStatus): boolean {
    return PARTICIPATION_TRANSITIONS[from]?.includes(to) ?? false
  }

  it('pending -> selected is valid', () => {
    expect(canTransition('pending', 'selected')).toBe(true)
  })

  it('pending -> not_selected is valid', () => {
    expect(canTransition('pending', 'not_selected')).toBe(true)
  })

  it('selected -> not_selected is valid', () => {
    expect(canTransition('selected', 'not_selected')).toBe(true)
  })

  it('not_selected -> selected is valid', () => {
    expect(canTransition('not_selected', 'selected')).toBe(true)
  })
})
