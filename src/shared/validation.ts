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

// ── Athlete registration ──────────────────────────────────────────────────────

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
  athleteEmail: z.string().email().optional(),
  athletePhone: z.string().optional(),
  // Manager info (if registering via manager)
  managerId: z.string().optional(),
  // Event application
  eventId: z.string().min(1),
  personalBest: z.string().min(1),
  seasonBest: z.string().min(1),
  worldRanking: z.number().int().min(1).optional(),
  // Compliance
  iRunClean: z.enum(['yes', 'no', 'in_progress', 'unknown']).default('unknown'),
  dopingFree: z.enum(['yes', 'no', 'unknown']).default('unknown'),
  // Notes
  participantNotes: z.string().optional(),
  additionalNotes: z.string().optional(),
})

export const batchAthleteRegistrationSchema = z.object({
  athletes: z.array(athleteRegistrationSchema).min(1),
})

// ── Manager registration ──────────────────────────────────────────────────────

export const managerRegistrationSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  organization: z.string().optional(),
})

// ── Contract offer ────────────────────────────────────────────────────────────

export const contractOfferSchema = z.object({
  bonus: z.number().int().min(0).default(0),
  otherCompensation: z.number().int().min(0).default(0),
  transport: z.number().int().min(0).default(0),
  localTransport: z.boolean().default(false),
  hotelNightTue: z.boolean().default(false),
  hotelNightWed: z.boolean().default(false),
  hotelNightThu: z.boolean().default(false),
  hotelNightFri: z.boolean().default(false),
  hotelNightSat: z.boolean().default(false),
  hotelNightSun: z.boolean().default(false),
  catering: z.number().int().min(0).default(0),
  notes: z.string().optional(),
})

// ── Application status change ─────────────────────────────────────────────────

export const statusChangeSchema = z.object({
  status: z.enum(['to_review', 'contract_sent', 'counter_offer', 'accepted', 'rejected', 'withdrawn']),
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
