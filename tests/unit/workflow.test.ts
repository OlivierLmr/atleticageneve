import { describe, it, expect } from 'vitest'
import { NEGOTIATION_TRANSITIONS, PARTICIPATION_TRANSITIONS } from '@shared/constants'
import type { NegotiationStatus, ParticipationStatus } from '@shared/types'

describe('Negotiation workflow transitions', () => {
  function canTransition(from: NegotiationStatus, to: NegotiationStatus): boolean {
    return NEGOTIATION_TRANSITIONS[from]?.includes(to) ?? false
  }

  // Valid transitions
  it('to_review -> agreement_sent is valid', () => {
    expect(canTransition('to_review', 'agreement_sent')).toBe(true)
  })

  it('to_review -> rejected is valid', () => {
    expect(canTransition('to_review', 'rejected')).toBe(true)
  })

  it('agreement_sent -> confirmed is valid', () => {
    expect(canTransition('agreement_sent', 'confirmed')).toBe(true)
  })

  it('agreement_sent -> counter_offer_sent is valid', () => {
    expect(canTransition('agreement_sent', 'counter_offer_sent')).toBe(true)
  })

  it('agreement_sent -> withdrawn is valid', () => {
    expect(canTransition('agreement_sent', 'withdrawn')).toBe(true)
  })

  it('counter_offer_sent -> agreement_sent is valid (re-send)', () => {
    expect(canTransition('counter_offer_sent', 'agreement_sent')).toBe(true)
  })

  it('confirmed -> withdrawn is valid', () => {
    expect(canTransition('confirmed', 'withdrawn')).toBe(true)
  })

  // Invalid transitions
  it('to_review -> confirmed is invalid (must send agreement first)', () => {
    expect(canTransition('to_review', 'confirmed')).toBe(false)
  })

  it('to_review -> counter_offer_sent is invalid', () => {
    expect(canTransition('to_review', 'counter_offer_sent')).toBe(false)
  })

  it('counter_offer_sent -> confirmed is invalid (org must re-send agreement)', () => {
    expect(canTransition('counter_offer_sent', 'confirmed')).toBe(false)
  })

  it('rejected -> anything is invalid (terminal state)', () => {
    const allStatuses: NegotiationStatus[] = ['to_review', 'agreement_sent', 'counter_offer_sent', 'confirmed', 'withdrawn']
    for (const status of allStatuses) {
      expect(canTransition('rejected', status)).toBe(false)
    }
  })

  it('withdrawn -> anything is invalid (terminal state)', () => {
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
