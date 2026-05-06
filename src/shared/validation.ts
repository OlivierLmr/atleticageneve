import { z } from 'zod'

// ── Auth ──────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export const magicLinkRequestSchema = z.object({
  email: z.string().email(),
})

export const magicLinkVerifySchema = z.object({
  token: z.string().min(1),
})

// ── Athlete registration (by athlete) ────────────────────────────────────────

export const athleteRegistrationSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().optional(),
  nationality: z.string().min(2).max(3),
  gender: z.enum(['M', 'F']),
  federation: z.string().optional(),
  isEap: z.boolean().default(false),
  isSwiss: z.boolean().default(false),
  distanceFromGva: z.number().int().min(0).optional(),
  waProfileUrl: z.string().url().optional().or(z.literal('')),
  swiLicence: z.string().optional(),
  athleteEmail: z.string().email(),
  athletePhone: z.string().optional(),
  managerId: z.string().optional(),
  eventIds: z.array(z.string().min(1)).min(1),
  iRunClean: z.boolean().default(false).transform(v => v ? 'yes' as const : 'unknown' as const),
  dopingFree: z.boolean().default(false).transform(v => v ? 'yes' as const : 'unknown' as const),
  participantNotes: z.string().optional(),
  additionalNotes: z.string().optional(),
  eapCity: z.string().optional(),
}).refine((data) => {
  if (data.isEap && !data.eapCity) return false
  return true
}, { message: 'eapCity is required when isEap is true', path: ['eapCity'] })

// ── Batch athlete registration (by manager) ──────────────────────────────────

export const batchAthleteSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().optional(),
  nationality: z.string().min(2).max(3),
  gender: z.enum(['M', 'F']),
  isEap: z.boolean().default(false),
  eapCity: z.string().optional(),
  waProfileUrl: z.string().url().optional().or(z.literal('')),
  eventIds: z.array(z.string().min(1)).min(1),
}).refine((data) => {
  if (data.isEap && !data.eapCity) return false
  return true
}, { message: 'eapCity is required when isEap is true', path: ['eapCity'] })

export const batchAthleteRegistrationSchema = z.object({
  athletes: z.array(batchAthleteSchema).min(1),
})

// ── Manager registration ──────────────────────────────────────────────────────

export const managerRegistrationSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  organization: z.string().optional(),
})

// ── Athlete update (PATCH) ───────────────────────────────────────────────────

export const athleteUpdateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  dateOfBirth: z.string().optional().nullable(),
  nationality: z.string().min(2).max(3).optional(),
  gender: z.enum(['M', 'F']).optional(),
  federation: z.string().optional().nullable(),
  club: z.string().optional().nullable(),
  isEap: z.boolean().optional(),
  isSwiss: z.boolean().optional(),
  distanceFromGva: z.number().int().min(0).optional(),
  waProfileUrl: z.string().url().optional().nullable().or(z.literal('')),
  swiLicence: z.string().optional().nullable(),
  honours: z.string().optional().nullable(),
  athleteEmail: z.string().email().optional().nullable(),
  athletePhone: z.string().optional().nullable(),
  eapCity: z.string().optional().nullable(),
  iRunClean: z.enum(['yes', 'no', 'in_progress', 'unknown']).optional(),
  dopingFree: z.enum(['yes', 'no', 'unknown']).optional(),
  assignedSelector: z.string().optional().nullable(),
  accommodationReqs: z.string().optional().nullable(),
  arrivalDate: z.string().optional().nullable(),
  arrivalFlight: z.string().optional().nullable(),
  arrivalFrom: z.string().optional().nullable(),
  arrivalTime: z.string().optional().nullable(),
  departureDate: z.string().optional().nullable(),
  departureFlight: z.string().optional().nullable(),
  departureTo: z.string().optional().nullable(),
  departureTime: z.string().optional().nullable(),
  bankIban: z.string().optional().nullable(),
  paymentStatus: z.enum(['pending', 'done']).optional(),
  paymentAmount: z.number().int().min(0).optional().nullable(),
  paymentDate: z.string().optional().nullable(),
  paymentMethod: z.enum(['cash', 'bank', 'western_union', 'paypal', 'other']).optional().nullable(),
  participantNotes: z.string().optional().nullable(),
  additionalNotes: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
}).refine((data) => {
  if (data.isEap === true && 'eapCity' in data && !data.eapCity) return false
  return true
}, { message: 'eapCity is required when isEap is true', path: ['eapCity'] })

// ── Agreement ─────────────────────────────────────────────────────────────────

export const agreementSchema = z.object({
  appearanceFee: z.number().int().min(0).default(0),
  otherCompensation: z.number().int().min(0).default(0),
  otherCompensationDesc: z.string().optional(),
  transport: z.number().int().min(0).default(0),
  transportAirportHotel: z.boolean().default(false),
  transportHotelStadium: z.boolean().default(false),
  hotelRoomId: z.string().optional(),
  hotelNightTue: z.boolean().default(false),
  hotelNightWed: z.boolean().default(false),
  hotelNightThu: z.boolean().default(false),
  hotelNightFri: z.boolean().default(false),
  hotelNightSat: z.boolean().default(false),
  hotelNightSun: z.boolean().default(false),
  dinnerTue: z.boolean().default(false),
  dinnerWed: z.boolean().default(false),
  dinnerThu: z.boolean().default(false),
  dinnerFri: z.boolean().default(false),
  dinnerSat: z.boolean().default(false),
  dinnerSun: z.boolean().default(false),
  stadiumMeals: z.boolean().default(false),
  notes: z.string().optional(),
})

// ── Negotiation status change (athlete-level) ────────────────────────────────

export const negotiationStatusChangeSchema = z.object({
  status: z.enum(['to_review', 'agreement_sent', 'counter_offer_sent', 'confirmed', 'rejected', 'withdrawn']),
})

// ── Participation status change (per-event) ──────────────────────────────────

export const participationStatusChangeSchema = z.object({
  participationStatus: z.enum(['pending', 'selected', 'not_selected']),
})

// ── Event create ──────────────────────────────────────────────────────────────

export const eventCreateSchema = z.object({
  catalogId: z.string().min(1),
  maxSlots: z.number().int().min(1),
  intMinima: z.number().positive(),
  swissMinima: z.number().positive(),
  eapMinima: z.number().positive().optional(),
  meetRecord: z.number().optional(),
  targetPerf: z.number().optional(),
  swissQuota: z.number().int().min(0).default(1),
  eapQuota: z.number().int().min(0).default(1),
  prizeMoney1st: z.number().int().min(0).optional(),
  prizeMoney2nd: z.number().int().min(0).optional(),
  prizeMoney3rd: z.number().int().min(0).optional(),
  prizeMoney4th: z.number().int().min(0).optional(),
  prizeMoney5th: z.number().int().min(0).optional(),
  prizeMoney6th: z.number().int().min(0).optional(),
  prizeMoney7th: z.number().int().min(0).optional(),
  prizeMoney8th: z.number().int().min(0).optional(),
})

// ── Event update ──────────────────────────────────────────────────────────────

export const eventUpdateSchema = z.object({
  maxSlots: z.number().int().min(1).optional(),
  intMinima: z.number().positive().optional(),
  swissMinima: z.number().positive().optional(),
  eapMinima: z.number().positive().optional().nullable(),
  meetRecord: z.number().optional().nullable(),
  targetPerf: z.number().optional().nullable(),
  swissQuota: z.number().int().min(0).optional(),
  eapQuota: z.number().int().min(0).optional(),
  prizeMoney1st: z.number().int().min(0).optional(),
  prizeMoney2nd: z.number().int().min(0).optional(),
  prizeMoney3rd: z.number().int().min(0).optional(),
  prizeMoney4th: z.number().int().min(0).optional(),
  prizeMoney5th: z.number().int().min(0).optional(),
  prizeMoney6th: z.number().int().min(0).optional(),
  prizeMoney7th: z.number().int().min(0).optional(),
  prizeMoney8th: z.number().int().min(0).optional(),
})

// ── Edition config ────────────────────────────────────────────────────────────

const DEFAULT_WEIGHT_PB = 25
const DEFAULT_WEIGHT_SB = 35
const DEFAULT_WEIGHT_RANKING = 30
const DEFAULT_WEIGHT_COST = 10

export const editionConfigSchema = z.object({
  name: z.string().min(1).optional(),
  year: z.number().int().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  currency: z.string().optional(),
  totalBudget: z.number().int().min(0).optional(),
  stadiumMealCost: z.number().int().min(0).optional(),
  transportAirportHotelCost: z.number().int().min(0).optional(),
  transportHotelStadiumCost: z.number().int().min(0).optional(),
  notificationEmail: z.string().email().optional(),
  weightPB: z.number().int().min(0).max(100).optional(),
  weightSB: z.number().int().min(0).max(100).optional(),
  weightRanking: z.number().int().min(0).max(100).optional(),
  weightCost: z.number().int().min(0).max(100).optional(),
  bonusEap: z.number().int().min(0).max(100).optional(),
  managerTierBonus: z.number().int().min(0).optional(),
}).refine((data) => {
  const hasAnyWeight = data.weightPB !== undefined || data.weightSB !== undefined ||
    data.weightRanking !== undefined || data.weightCost !== undefined
  if (!hasAnyWeight) return true
  const sum = (data.weightPB ?? DEFAULT_WEIGHT_PB) +
    (data.weightSB ?? DEFAULT_WEIGHT_SB) +
    (data.weightRanking ?? DEFAULT_WEIGHT_RANKING) +
    (data.weightCost ?? DEFAULT_WEIGHT_COST)
  return sum === 100
}, { message: 'Weight fields (weightPB + weightSB + weightRanking + weightCost) must sum to 100' })

// ── Hotel ─────────────────────────────────────────────────────────────────────

export const hotelSchema = z.object({
  name: z.string().min(1),
})

export const hotelRoomSchema = z.object({
  hotelId: z.string().min(1),
  roomType: z.string().min(1),
  costPerNight: z.number().int().min(0),
  dinnerCost: z.number().int().min(0),
  reservedRooms: z.number().int().min(0),
})

// ── Event catalog ─────────────────────────────────────────────────────────────

export const eventCatalogSchema = z.object({
  name: z.string().min(1),
  discipline: z.enum(['Course', 'Concours']),
  gender: z.enum(['M', 'F']),
  waName: z.string().min(1).nullable().optional(),
  waRankingSlug: z.string().nullable().optional(),
})

// ── Country ───────────────────────────────────────────────────────────────────

export const countrySchema = z.object({
  code: z.string().length(3),
  name: z.string().min(1),
  distanceFromGva: z.number().int().min(0).optional(),
})

// ── Cost Tier Config ──────────────────────────────────────────────────────────

export const costTierConfigSchema = z.object({
  tier: z.number().int().min(1),
  rankingMin: z.number().int().min(1).nullable().optional(),
  rankingMax: z.number().int().min(1).nullable().optional(),
  appearanceFee: z.number().int().min(0),
  nightlyRate: z.number().int().min(0),
})

export const costTierConfigsSchema = z.array(costTierConfigSchema)

// ── Cost Distance Config ──────────────────────────────────────────────────────

export const costDistanceConfigSchema = z.object({
  distanceMax: z.number().int().min(0).nullable().optional(),
  travelCost: z.number().int().min(0),
  nights: z.number().int().min(0),
})

export const costDistanceConfigsSchema = z.array(costDistanceConfigSchema)

// ── EAP city ──────────────────────────────────────────────────────────────────

export const eapCitySchema = z.object({
  name: z.string().min(1),
  countryCode: z.string().length(3),
})

// ── WA Performance ───────────────────────────────────────────────────────────

export const waPerformanceSchema = z.object({
  athleteId: z.string().min(1),
  eventId: z.string().min(1),
  personalBest: z.number().optional(),
  seasonBest: z.number().optional(),
  worldRanking: z.number().int().min(1).optional(),
})

// ── Interaction ──────────────────────────────────────────────────────────────

export const interactionSchema = z.object({
  type: z.enum(['email', 'call', 'note', 'counter_offer', 'status_change', 'agreement']),
  content: z.string().min(1),
  applicationId: z.string().optional(),
})

// ── Auth identify / login ────────────────────────────────────────────────────

export const identifySchema = z.object({
  identifier: z.string().min(1),
})

export const loginWithPasswordSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
})

// ── Portal respond ───────────────────────────────────────────────────────────

export const portalRespondSchema = z.object({
  action: z.enum(['accept', 'reject', 'withdraw', 'counter_offer']),
  offer: agreementSchema.optional(),
})

// ── Hotel room update ────────────────────────────────────────────────────────

export const hotelRoomUpdateSchema = hotelRoomSchema.omit({ hotelId: true }).partial()
