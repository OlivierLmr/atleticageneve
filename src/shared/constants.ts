import type { PerfType, NegotiationStatus, ParticipationStatus } from './types'

// ── Event metadata for scoring ────────────────────────────────────────────────

export interface EventMeta {
  type: PerfType
  intMinima: number // international minima (seconds or meters)
  swiMinima: number // Swiss minima
}

// Time-based minima in seconds; field distances in meters.
export const EVENT_META: Record<string, EventMeta> = {
  '100m-m':   { type: 'MIN', intMinima: 10.00,  swiMinima: 10.15  },
  '100m-f':   { type: 'MIN', intMinima: 11.15,  swiMinima: 11.30  },
  '400m-m':   { type: 'MIN', intMinima: 44.90,  swiMinima: 45.50  },
  '400m-h-f': { type: 'MIN', intMinima: 48.00,  swiMinima: 49.00  },
  '1500m-m':  { type: 'MIN', intMinima: 213.50, swiMinima: 216.00 }, // 3:33.50 / 3:36.00
  'hj-m':     { type: 'MAX', intMinima: 2.30,   swiMinima: 2.25   },
  'lj-f':     { type: 'MAX', intMinima: 6.86,   swiMinima: 6.70   },
}

// ── Valid workflow transitions — negotiation (athlete-level) ─────────────────

/** @deprecated Use NEGOTIATION_TRANSITIONS */
export const VALID_TRANSITIONS: Record<NegotiationStatus, NegotiationStatus[]> = {
  to_review:     ['contract_sent', 'rejected'],
  contract_sent: ['accepted', 'rejected', 'counter_offer', 'withdrawn'],
  counter_offer: ['contract_sent', 'rejected', 'withdrawn'],
  accepted:      ['withdrawn'],
  rejected:      [],
  withdrawn:     [],
}

export const NEGOTIATION_TRANSITIONS = VALID_TRANSITIONS

// ── Valid transitions — participation (per-event) ────────────────────────────

export const PARTICIPATION_TRANSITIONS: Record<ParticipationStatus, ParticipationStatus[]> = {
  pending:      ['selected', 'not_selected'],
  selected:     ['not_selected'],
  not_selected: ['selected'],
}

// ── Budget & quotas ───────────────────────────────────────────────────────────

export const DEFAULT_TOTAL_BUDGET = 250_000

// ── Night labels for hotel night picker ───────────────────────────────────────

export const NIGHT_LABELS = ['tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type NightKey = (typeof NIGHT_LABELS)[number]

// ── Dinner labels (same days as nights) ──────────────────────────────────────

export const DINNER_LABELS = NIGHT_LABELS
