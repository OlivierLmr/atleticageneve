import type { NegotiationStatus, ParticipationStatus } from './types'

// Staff (collaborator/committee) allowed direct status transitions.
// Note: agreement_sent is only reached via agreement creation (POST /agreements), never via direct PATCH.
// During agreement_sent, the ball is in the athlete/manager's court — staff cannot act.
export const NEGOTIATION_TRANSITIONS: Record<NegotiationStatus, NegotiationStatus[]> = {
  to_review:           ['rejected'],
  agreement_sent:      [],
  counter_offer_sent:  ['rejected'],
  confirmed:           [],
  rejected:            [],
  withdrawn:           [],
}

// Committee-only extra transitions (Rattraper + admin override)
export const COMMITTEE_EXTRA_TRANSITIONS: Record<NegotiationStatus, NegotiationStatus[]> = {
  to_review:           [],
  agreement_sent:      [],
  counter_offer_sent:  [],
  confirmed:           ['rejected'],
  rejected:            ['to_review'],
  withdrawn:           ['to_review'],
}

// Athlete/manager transitions (per PDF spec "Pour l'athlète ou le manager")
export const ATHLETE_TRANSITIONS: Record<NegotiationStatus, NegotiationStatus[]> = {
  to_review:           ['withdrawn'],
  agreement_sent:      ['confirmed', 'counter_offer_sent', 'withdrawn'],
  counter_offer_sent:  ['withdrawn'],
  confirmed:           ['withdrawn'],
  rejected:            [],
  withdrawn:           [],
}

export const PARTICIPATION_TRANSITIONS: Record<ParticipationStatus, ParticipationStatus[]> = {
  pending:      ['selected', 'not_selected'],
  selected:     ['not_selected'],
  not_selected: ['selected'],
}

export const NIGHT_LABELS = ['tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type NightKey = (typeof NIGHT_LABELS)[number]

export const DINNER_LABELS = NIGHT_LABELS
