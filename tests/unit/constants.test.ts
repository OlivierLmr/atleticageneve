import { describe, it, expect } from 'vitest'
import { VALID_TRANSITIONS, EVENT_META, DEFAULT_TOTAL_BUDGET, NIGHT_LABELS } from '@shared/constants'

describe('VALID_TRANSITIONS', () => {
  it('to_review can move to contract_sent or rejected', () => {
    expect(VALID_TRANSITIONS.to_review).toContain('contract_sent')
    expect(VALID_TRANSITIONS.to_review).toContain('rejected')
    expect(VALID_TRANSITIONS.to_review).not.toContain('accepted')
  })

  it('contract_sent can move to accepted, rejected, counter_offer, or withdrawn', () => {
    expect(VALID_TRANSITIONS.contract_sent).toContain('accepted')
    expect(VALID_TRANSITIONS.contract_sent).toContain('rejected')
    expect(VALID_TRANSITIONS.contract_sent).toContain('counter_offer')
    expect(VALID_TRANSITIONS.contract_sent).toContain('withdrawn')
  })

  it('counter_offer can move to contract_sent, rejected, or withdrawn', () => {
    expect(VALID_TRANSITIONS.counter_offer).toContain('contract_sent')
    expect(VALID_TRANSITIONS.counter_offer).toContain('rejected')
    expect(VALID_TRANSITIONS.counter_offer).toContain('withdrawn')
    expect(VALID_TRANSITIONS.counter_offer).not.toContain('accepted')
  })

  it('accepted can only be withdrawn', () => {
    expect(VALID_TRANSITIONS.accepted).toEqual(['withdrawn'])
  })

  it('rejected is a terminal state', () => {
    expect(VALID_TRANSITIONS.rejected).toEqual([])
  })

  it('withdrawn is a terminal state', () => {
    expect(VALID_TRANSITIONS.withdrawn).toEqual([])
  })
})

describe('DEFAULT_TOTAL_BUDGET', () => {
  it('is 250,000 CHF', () => {
    expect(DEFAULT_TOTAL_BUDGET).toBe(250_000)
  })
})

describe('NIGHT_LABELS', () => {
  it('has 6 nights from Tuesday to Sunday', () => {
    expect(NIGHT_LABELS).toEqual(['tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
  })
})

describe('EVENT_META completeness', () => {
  it('all events have positive minima values', () => {
    for (const [id, meta] of Object.entries(EVENT_META)) {
      expect(meta.intMinima).toBeGreaterThan(0)
      expect(meta.swiMinima).toBeGreaterThan(0)
    }
  })
})
