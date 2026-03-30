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
  distanceFromGva: z.number().int().min(0).default(0),
  waProfileUrl: z.string().url().optional().or(z.literal('')),
  swiLicence: z.string().optional(),
  athleteEmail: z.string().email(),
  athletePhone: z.string().optional(),
  // Manager info (if registering via manager)
  managerId: z.string().optional(),
  // Event applications — multiple events
  eventIds: z.array(z.string().min(1)).min(1),
  // Compliance (boolean checkboxes)
  iRunClean: z.boolean().default(false),
  dopingFree: z.boolean().default(false),
  // Notes
  participantNotes: z.string().optional(),
  additionalNotes: z.string().optional(),
})

// ── Batch athlete registration (by manager) ──────────────────────────────────

export const batchAthleteSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().min(1),
  nationality: z.string().min(2).max(3),
  gender: z.enum(['M', 'F']),
  isEap: z.boolean().default(false),
  waProfileUrl: z.string().url().optional().or(z.literal('')),
  eventIds: z.array(z.string().min(1)).min(1),
})

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

// ── Athlete personal data update (PATCH) ─────────────────────────────────────

export const athleteUpdateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  dateOfBirth: z.string().optional().nullable(),
  nationality: z.string().min(2).max(3).optional(),
  gender: z.enum(['M', 'F']).optional(),
  federation: z.string().optional().nullable(),
  isEap: z.boolean().optional(),
  isSwiss: z.boolean().optional(),
  waProfileUrl: z.string().url().optional().nullable().or(z.literal('')),
  swiLicence: z.string().optional().nullable(),
  athleteEmail: z.string().email().optional().nullable(),
  athletePhone: z.string().optional().nullable(),
  eapCity: z.string().optional().nullable(),
  iRunClean: z.enum(['yes', 'no', 'in_progress', 'unknown']).optional(),
  dopingFree: z.enum(['yes', 'no', 'unknown']).optional(),
})

// ── Contract offer ────────────────────────────────────────────────────────────

export const contractOfferSchema = z.object({
  bonus: z.number().int().min(0).default(0),
  otherCompensation: z.number().int().min(0).default(0),
  otherCompensationDesc: z.string().optional(),
  transport: z.number().int().min(0).default(0),
  transportAirportHotel: z.boolean().default(false),
  transportHotelStadium: z.boolean().default(false),
  hotelId: z.string().optional(),
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
  status: z.enum(['to_review', 'contract_sent', 'counter_offer', 'accepted', 'rejected', 'withdrawn']),
})

/** @deprecated Use negotiationStatusChangeSchema */
export const statusChangeSchema = negotiationStatusChangeSchema

// ── Participation status change (per-event) ──────────────────────────────────

export const participationStatusChangeSchema = z.object({
  participationStatus: z.enum(['pending', 'selected', 'not_selected']),
})

// ── Logistics update ──────────────────────────────────────────────────────────

export const logisticsUpdateSchema = z.object({
  arrivalDate: z.string().optional().nullable(),
  arrivalFlight: z.string().optional().nullable(),
  arrivalFrom: z.string().optional().nullable(),
  arrivalTime: z.string().optional().nullable(),
  departureDate: z.string().optional().nullable(),
  departureFlight: z.string().optional().nullable(),
  departureTo: z.string().optional().nullable(),
  departureTime: z.string().optional().nullable(),
  accommodationReqs: z.string().optional().nullable(),
})

// ── Event config ──────────────────────────────────────────────────────────────

export const eventConfigSchema = z.object({
  name: z.string().min(1),
  discipline: z.string().min(1),
  gender: z.enum(['M', 'F']),
  perfType: z.enum(['MIN', 'MAX']),
  maxSlots: z.number().int().min(1),
  intMinima: z.number().positive(),
  swissMinima: z.number().positive(),
  eapMinima: z.number().positive().optional(),
  meetRecord: z.string().optional(),
  targetPerf: z.string().optional(),
  swissQuota: z.number().int().min(0).default(1),
  eapQuota: z.number().int().min(0).default(1),
  prize1st: z.number().int().min(0).default(0),
  prize2nd: z.number().int().min(0).default(0),
  prize3rd: z.number().int().min(0).default(0),
})

// ── Hotel config ──────────────────────────────────────────────────────────────

export const hotelConfigSchema = z.object({
  name: z.string().min(1),
  roomTypes: z.string().optional(),
  costPerNight: z.number().int().min(0),
  totalRooms: z.number().int().min(0),
})

// ── WA Performance ───────────────────────────────────────────────────────────

export const waPerformanceSchema = z.object({
  personalBest: z.string().optional(),
  personalBestVal: z.number().optional(),
  seasonBest: z.string().optional(),
  seasonBestVal: z.number().optional(),
  worldRanking: z.number().int().min(1).optional(),
})
