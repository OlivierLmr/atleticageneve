import type { NegotiationStatus, ParticipationStatus } from '@shared/types'

export const STATUS_COLORS: Record<NegotiationStatus, string> = {
  to_review: 'bg-yellow-100 text-yellow-800',
  agreement_sent: 'bg-blue-100 text-blue-800',
  counter_offer_sent: 'bg-purple-100 text-purple-800',
  confirmed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-gray-100 text-gray-500',
}

export const PARTICIPATION_COLORS: Record<ParticipationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  selected: 'bg-green-100 text-green-800',
  not_selected: 'bg-red-100 text-red-800',
}

export function formatPerf(value: number | null | undefined): string {
  if (value == null) return '—'
  // Times (under 1000) are in seconds — format as mm:ss.cc or ss.cc
  if (value < 100) return value.toFixed(2)
  if (value < 1000) {
    const min = Math.floor(value / 60)
    const sec = (value % 60).toFixed(2).padStart(5, '0')
    return min > 0 ? `${min}:${sec}` : sec
  }
  // Distances/heights in cm — format as m.cm
  return (value / 100).toFixed(2)
}
