import { describe, it, expect } from 'vitest'
import { NEGOTIATION_TRANSITIONS } from '@shared/constants'
import { agreementSchema } from '@shared/validation'
import type { NegotiationStatus } from '@shared/types'

// ── Counter-offer flow tests (athlete portal perspective) ────────────────────

describe('counter-offer workflow', () => {
  it('agreement_sent allows counter_offer_sent', () => {
    expect(NEGOTIATION_TRANSITIONS.agreement_sent).toContain('counter_offer_sent')
  })

  it('counter_offer_sent allows revised agreement_sent', () => {
    expect(NEGOTIATION_TRANSITIONS.counter_offer_sent).toContain('agreement_sent')
  })

  it('counter_offer_sent does not allow direct confirm', () => {
    // Only the organizer can re-send, then athlete confirms
    expect(NEGOTIATION_TRANSITIONS.counter_offer_sent).not.toContain('confirmed')
  })

  it('counter_offer_sent allows rejection', () => {
    expect(NEGOTIATION_TRANSITIONS.counter_offer_sent).toContain('rejected')
  })

  it('counter_offer_sent allows withdrawal', () => {
    expect(NEGOTIATION_TRANSITIONS.counter_offer_sent).toContain('withdrawn')
  })
})

describe('confirm/reject/withdraw from agreement_sent', () => {
  it('allows confirm', () => {
    expect(NEGOTIATION_TRANSITIONS.agreement_sent).toContain('confirmed')
  })

  it('allows reject', () => {
    expect(NEGOTIATION_TRANSITIONS.agreement_sent).toContain('rejected')
  })

  it('allows withdraw', () => {
    expect(NEGOTIATION_TRANSITIONS.agreement_sent).toContain('withdrawn')
  })

  it('does not allow going back to to_review', () => {
    expect(NEGOTIATION_TRANSITIONS.agreement_sent).not.toContain('to_review')
  })
})

describe('terminal states', () => {
  it('rejected has no transitions', () => {
    expect(NEGOTIATION_TRANSITIONS.rejected).toHaveLength(0)
  })

  it('withdrawn has no transitions', () => {
    expect(NEGOTIATION_TRANSITIONS.withdrawn).toHaveLength(0)
  })

  it('confirmed only allows withdraw', () => {
    expect(NEGOTIATION_TRANSITIONS.confirmed).toEqual(['withdrawn'])
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
  it('supports full negotiation: to_review -> agreement_sent -> counter_offer_sent -> agreement_sent -> confirmed', () => {
    const path: NegotiationStatus[] = ['to_review', 'agreement_sent', 'counter_offer_sent', 'agreement_sent', 'confirmed']

    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i]
      const to = path[i + 1]
      expect(
        NEGOTIATION_TRANSITIONS[from],
        `Expected ${from} -> ${to} to be valid`
      ).toContain(to)
    }
  })

  it('supports early rejection: to_review -> rejected', () => {
    expect(NEGOTIATION_TRANSITIONS.to_review).toContain('rejected')
  })

  it('supports withdrawal after confirmation: confirmed -> withdrawn', () => {
    expect(NEGOTIATION_TRANSITIONS.confirmed).toContain('withdrawn')
  })
})
