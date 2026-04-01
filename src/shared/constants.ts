import type { NegotiationStatus, ParticipationStatus } from './types'

export const NEGOTIATION_TRANSITIONS: Record<NegotiationStatus, NegotiationStatus[]> = {
  to_review:           ['agreement_sent', 'rejected'],
  agreement_sent:      ['confirmed', 'rejected', 'counter_offer_sent', 'withdrawn'],
  counter_offer_sent:  ['agreement_sent', 'rejected', 'withdrawn'],
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
