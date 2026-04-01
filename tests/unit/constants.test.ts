import { describe, it, expect } from 'vitest'
import { NEGOTIATION_TRANSITIONS, PARTICIPATION_TRANSITIONS, NIGHT_LABELS, DINNER_LABELS } from '@shared/constants'

describe('NEGOTIATION_TRANSITIONS', () => {
  it('to_review can move to agreement_sent or rejected', () => {
    expect(NEGOTIATION_TRANSITIONS.to_review).toContain('agreement_sent')
    expect(NEGOTIATION_TRANSITIONS.to_review).toContain('rejected')
    expect(NEGOTIATION_TRANSITIONS.to_review).not.toContain('confirmed')
  })

  it('agreement_sent can move to confirmed, rejected, counter_offer_sent, or withdrawn', () => {
    expect(NEGOTIATION_TRANSITIONS.agreement_sent).toContain('confirmed')
    expect(NEGOTIATION_TRANSITIONS.agreement_sent).toContain('rejected')
    expect(NEGOTIATION_TRANSITIONS.agreement_sent).toContain('counter_offer_sent')
    expect(NEGOTIATION_TRANSITIONS.agreement_sent).toContain('withdrawn')
  })

  it('counter_offer_sent can move to agreement_sent, rejected, or withdrawn', () => {
    expect(NEGOTIATION_TRANSITIONS.counter_offer_sent).toContain('agreement_sent')
    expect(NEGOTIATION_TRANSITIONS.counter_offer_sent).toContain('rejected')
    expect(NEGOTIATION_TRANSITIONS.counter_offer_sent).toContain('withdrawn')
    expect(NEGOTIATION_TRANSITIONS.counter_offer_sent).not.toContain('confirmed')
  })

  it('confirmed can only be withdrawn', () => {
    expect(NEGOTIATION_TRANSITIONS.confirmed).toEqual(['withdrawn'])
  })

  it('rejected is a terminal state', () => {
    expect(NEGOTIATION_TRANSITIONS.rejected).toEqual([])
  })

  it('withdrawn is a terminal state', () => {
    expect(NEGOTIATION_TRANSITIONS.withdrawn).toEqual([])
  })
})

describe('PARTICIPATION_TRANSITIONS', () => {
  it('pending can move to selected or not_selected', () => {
    expect(PARTICIPATION_TRANSITIONS.pending).toContain('selected')
    expect(PARTICIPATION_TRANSITIONS.pending).toContain('not_selected')
  })

  it('selected can move to not_selected', () => {
    expect(PARTICIPATION_TRANSITIONS.selected).toContain('not_selected')
  })

  it('not_selected can move to selected', () => {
    expect(PARTICIPATION_TRANSITIONS.not_selected).toContain('selected')
  })
})

describe('NIGHT_LABELS', () => {
  it('has 6 nights from Tuesday to Sunday', () => {
    expect(NIGHT_LABELS).toEqual(['tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
  })
})

describe('DINNER_LABELS', () => {
  it('matches NIGHT_LABELS', () => {
    expect(DINNER_LABELS).toEqual(NIGHT_LABELS)
  })
})
