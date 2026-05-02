import { describe, it, expect } from 'vitest'
import { ATHLETE_TRANSITIONS, NEGOTIATION_TRANSITIONS } from '@shared/constants'
import { agreementSchema } from '@shared/validation'
import type { NegotiationStatus } from '@shared/types'

// ── Counter-offer flow tests (athlete portal perspective) ────────────────────

describe('counter-offer workflow', () => {
  it('agreement_sent allows counter_offer_sent (athlete)', () => {
    expect(ATHLETE_TRANSITIONS.agreement_sent).toContain('counter_offer_sent')
  })

  it('counter_offer_sent does not allow direct confirm', () => {
    // Only the organizer can re-send, then athlete confirms
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

describe('confirm/reject/withdraw from agreement_sent', () => {
  it('allows confirm (athlete)', () => {
    expect(ATHLETE_TRANSITIONS.agreement_sent).toContain('confirmed')
  })

  it('allows withdraw (athlete)', () => {
    expect(ATHLETE_TRANSITIONS.agreement_sent).toContain('withdrawn')
  })

  it('does not allow going back to to_review', () => {
    expect(ATHLETE_TRANSITIONS.agreement_sent).not.toContain('to_review')
  })
})

describe('terminal states', () => {
  it('rejected has no base transitions', () => {
    expect(NEGOTIATION_TRANSITIONS.rejected).toHaveLength(0)
  })

  it('withdrawn has no base transitions', () => {
    expect(NEGOTIATION_TRANSITIONS.withdrawn).toHaveLength(0)
  })

  it('confirmed allows withdraw (athlete)', () => {
    expect(ATHLETE_TRANSITIONS.confirmed).toContain('withdrawn')
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

// ── Multi-round negotiation ──────────────────────────────────────────────────

describe('multi-round negotiation path', () => {
  it('supports athlete accepting: agreement_sent -> confirmed', () => {
    expect(ATHLETE_TRANSITIONS.agreement_sent).toContain('confirmed')
  })

  it('supports early rejection: to_review -> rejected', () => {
    expect(NEGOTIATION_TRANSITIONS.to_review).toContain('rejected')
  })

  it('supports withdrawal after confirmation: confirmed -> withdrawn (athlete)', () => {
    expect(ATHLETE_TRANSITIONS.confirmed).toContain('withdrawn')
  })
})
