import type { NegotiationStatus, ParticipationStatus } from './types'

// Base staff transitions — does NOT include agreement_sent (only via agreement creation)
export const NEGOTIATION_TRANSITIONS: Record<NegotiationStatus, NegotiationStatus[]> = {
  to_review:           ['rejected'],
  agreement_sent:      [],            // ball is in athlete/manager's court
  counter_offer_sent:  ['rejected'],  // agreement_sent is via agreement creation only
  confirmed:           [],            // staff cannot withdraw an athlete
  rejected:            [],
  withdrawn:           [],
}

// Committee-only extra transitions (override powers)
export const COMMITTEE_EXTRA_TRANSITIONS: Record<NegotiationStatus, NegotiationStatus[]> = {
  to_review:           [],
  agreement_sent:      [],
  counter_offer_sent:  [],
  confirmed:           ['rejected'],
  rejected:            ['to_review'],
  withdrawn:           ['to_review'],
}

// Athlete/manager transitions
export const ATHLETE_TRANSITIONS: Record<NegotiationStatus, NegotiationStatus[]> = {
  to_review:           ['withdrawn'],
  agreement_sent:      ['confirmed', 'counter_offer_sent', 'withdrawn'],
  counter_offer_sent:  ['withdrawn'],
  confirmed:           ['withdrawn'],
  rejected:            [],
  withdrawn:           [],
}

// Statuses from which staff can send an agreement (via agreement creation form)
export const SEND_AGREEMENT_FROM: NegotiationStatus[] = ['to_review', 'counter_offer_sent']

export const PARTICIPATION_TRANSITIONS: Record<ParticipationStatus, ParticipationStatus[]> = {
  pending:      ['selected', 'not_selected'],
  selected:     ['not_selected'],
  not_selected: ['selected'],
}

export const NIGHT_LABELS = ['tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type NightKey = (typeof NIGHT_LABELS)[number]

export const DINNER_LABELS = NIGHT_LABELS
