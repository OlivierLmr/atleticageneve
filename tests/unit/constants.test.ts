import { describe, it, expect } from 'vitest'
import { NEGOTIATION_TRANSITIONS, ATHLETE_TRANSITIONS, COMMITTEE_EXTRA_TRANSITIONS, PARTICIPATION_TRANSITIONS, NIGHT_LABELS, DINNER_LABELS } from '@shared/constants'

describe('NEGOTIATION_TRANSITIONS (collaborator base)', () => {
  it('to_review allows rejected', () => {
    expect(NEGOTIATION_TRANSITIONS.to_review).toContain('rejected')
  })

  it('to_review does not allow confirmed directly', () => {
    expect(NEGOTIATION_TRANSITIONS.to_review).not.toContain('confirmed')
  })

  it('agreement_sent has no base collaborator transitions', () => {
    expect(NEGOTIATION_TRANSITIONS.agreement_sent).toEqual([])
  })

  it('counter_offer_sent allows rejected', () => {
    expect(NEGOTIATION_TRANSITIONS.counter_offer_sent).toContain('rejected')
  })

  it('confirmed has no base collaborator transitions', () => {
    expect(NEGOTIATION_TRANSITIONS.confirmed).toEqual([])
  })

  it('rejected is a terminal state', () => {
    expect(NEGOTIATION_TRANSITIONS.rejected).toEqual([])
  })

  it('withdrawn is a terminal state', () => {
    expect(NEGOTIATION_TRANSITIONS.withdrawn).toEqual([])
  })
})

describe('ATHLETE_TRANSITIONS', () => {
  it('to_review allows withdrawn', () => {
    expect(ATHLETE_TRANSITIONS.to_review).toContain('withdrawn')
  })

  it('agreement_sent allows confirmed, counter_offer_sent, and withdrawn', () => {
    expect(ATHLETE_TRANSITIONS.agreement_sent).toContain('confirmed')
    expect(ATHLETE_TRANSITIONS.agreement_sent).toContain('counter_offer_sent')
    expect(ATHLETE_TRANSITIONS.agreement_sent).toContain('withdrawn')
  })

  it('counter_offer_sent allows withdrawn', () => {
    expect(ATHLETE_TRANSITIONS.counter_offer_sent).toContain('withdrawn')
  })

  it('confirmed allows withdrawn', () => {
    expect(ATHLETE_TRANSITIONS.confirmed).toContain('withdrawn')
  })
})

describe('COMMITTEE_EXTRA_TRANSITIONS', () => {
  it('confirmed allows rejected (committee override)', () => {
    expect(COMMITTEE_EXTRA_TRANSITIONS.confirmed).toContain('rejected')
  })

  it('rejected allows to_review (committee reopen)', () => {
    expect(COMMITTEE_EXTRA_TRANSITIONS.rejected).toContain('to_review')
  })

  it('withdrawn allows to_review (committee reopen)', () => {
    expect(COMMITTEE_EXTRA_TRANSITIONS.withdrawn).toContain('to_review')
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
