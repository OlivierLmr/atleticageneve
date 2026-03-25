import { describe, it, expect } from 'vitest'
import { VALID_TRANSITIONS, HOTEL_COST_PER_NIGHT } from '@shared/constants'
import { contractOfferSchema } from '@shared/validation'
import type { ApplicationStatus } from '@shared/types'

// ── Counter-offer flow tests ─────────────────────────────────────────────────

describe('counter-offer workflow', () => {
  it('contract_sent allows counter_offer', () => {
    expect(VALID_TRANSITIONS.contract_sent).toContain('counter_offer')
  })

  it('counter_offer allows revised contract_sent', () => {
    expect(VALID_TRANSITIONS.counter_offer).toContain('contract_sent')
  })

  it('counter_offer does not allow direct accept', () => {
    // Only the organizer can re-send, then athlete accepts
    expect(VALID_TRANSITIONS.counter_offer).not.toContain('accepted')
  })

  it('counter_offer allows rejection', () => {
    expect(VALID_TRANSITIONS.counter_offer).toContain('rejected')
  })

  it('counter_offer allows withdrawal', () => {
    expect(VALID_TRANSITIONS.counter_offer).toContain('withdrawn')
  })
})

describe('accept/reject/withdraw from contract_sent', () => {
  it('allows accept', () => {
    expect(VALID_TRANSITIONS.contract_sent).toContain('accepted')
  })

  it('allows reject', () => {
    expect(VALID_TRANSITIONS.contract_sent).toContain('rejected')
  })

  it('allows withdraw', () => {
    expect(VALID_TRANSITIONS.contract_sent).toContain('withdrawn')
  })

  it('does not allow going back to to_review', () => {
    expect(VALID_TRANSITIONS.contract_sent).not.toContain('to_review')
  })
})

describe('terminal states', () => {
  it('rejected has no transitions', () => {
    expect(VALID_TRANSITIONS.rejected).toHaveLength(0)
  })

  it('withdrawn has no transitions', () => {
    expect(VALID_TRANSITIONS.withdrawn).toHaveLength(0)
  })

  it('accepted only allows withdraw', () => {
    expect(VALID_TRANSITIONS.accepted).toEqual(['withdrawn'])
  })
})

// ── Counter-offer validation ─────────────────────────────────────────────────

describe('counter-offer validation', () => {
  it('accepts a valid counter-offer with modified bonus', () => {
    const result = contractOfferSchema.safeParse({
      bonus: 12000,
      transport: 1500,
      hotelNightThu: true,
      hotelNightFri: true,
      hotelNightSat: true,
    })
    expect(result.success).toBe(true)
  })

  it('accepts counter-offer with notes', () => {
    const result = contractOfferSchema.safeParse({
      bonus: 10000,
      notes: 'Would prefer an additional hotel night on Wednesday',
    })
    expect(result.success).toBe(true)
  })

  it('rejects counter-offer with negative values', () => {
    expect(contractOfferSchema.safeParse({ bonus: -5000 }).success).toBe(false)
    expect(contractOfferSchema.safeParse({ transport: -100 }).success).toBe(false)
    expect(contractOfferSchema.safeParse({ catering: -50 }).success).toBe(false)
  })
})

// ── Action mapping tests ─────────────────────────────────────────────────────

describe('action to status mapping', () => {
  const actionMap: Record<string, ApplicationStatus> = {
    accept: 'accepted',
    reject: 'rejected',
    withdraw: 'withdrawn',
    counter_offer: 'counter_offer',
  }

  it('maps accept to accepted', () => {
    expect(actionMap.accept).toBe('accepted')
  })

  it('maps reject to rejected', () => {
    expect(actionMap.reject).toBe('rejected')
  })

  it('maps withdraw to withdrawn', () => {
    expect(actionMap.withdraw).toBe('withdrawn')
  })

  it('maps counter_offer to counter_offer', () => {
    expect(actionMap.counter_offer).toBe('counter_offer')
  })
})

// ── Multi-round negotiation ──────────────────────────────────────────────────

describe('multi-round negotiation path', () => {
  it('supports full negotiation: to_review → contract_sent → counter_offer → contract_sent → accepted', () => {
    const path: ApplicationStatus[] = ['to_review', 'contract_sent', 'counter_offer', 'contract_sent', 'accepted']

    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i]
      const to = path[i + 1]
      expect(
        VALID_TRANSITIONS[from],
        `Expected ${from} → ${to} to be valid`
      ).toContain(to)
    }
  })

  it('supports early rejection: to_review → rejected', () => {
    expect(VALID_TRANSITIONS.to_review).toContain('rejected')
  })

  it('supports withdrawal after acceptance: accepted → withdrawn', () => {
    expect(VALID_TRANSITIONS.accepted).toContain('withdrawn')
  })
})
