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
  // Distances/heights stored in cm (≥1000 means ≥10m) — format as m.cm
  if (value >= 1000) return (value / 100).toFixed(2)
  // Times in seconds — format as ss.cc or m:ss.cc
  if (value < 60) return value.toFixed(2)
  const min = Math.floor(value / 60)
  const sec = (value % 60).toFixed(2).padStart(5, '0')
  return `${min}:${sec}`
}
