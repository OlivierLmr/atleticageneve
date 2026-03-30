// ── Status enums ──────────────────────────────────────────────────────────────

export type NegotiationStatus =
  | 'to_review'
  | 'contract_sent'
  | 'counter_offer'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'

/** @deprecated Use NegotiationStatus — kept for backward compat */
export type ApplicationStatus = NegotiationStatus

export type ParticipationStatus = 'pending' | 'selected' | 'not_selected'

export type OfferDirection = 'to_athlete' | 'to_organizer'

export type Gender = 'M' | 'F'

export type UserRole = 'athlete' | 'manager' | 'collaborator' | 'committee'

export type IRunCleanStatus = 'yes' | 'no' | 'in_progress' | 'unknown'
export type DopingFreeStatus = 'yes' | 'no' | 'unknown'
export type PaymentStatus = 'pending' | 'done'
export type PaymentMethod = 'cash' | 'bank' | 'western_union' | 'paypal' | 'other'
export type MealType = 'breakfast' | 'lunch' | 'dinner'
export type PerfType = 'MIN' | 'MAX' // MIN = lower is better (time), MAX = higher is better (distance)

// ── Domain entities ───────────────────────────────────────────────────────────

export interface User {
  id: string
  role: UserRole
  email: string | null
  phone: string | null
  username: string | null
  firstName: string
  lastName: string
  organization: string | null
  preferredLang: 'en' | 'fr'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Edition {
  id: string
  name: string
  year: number
  startDate: string
  endDate: string
  totalBudget: number
  dinnerCostPp: number
  stadiumMealCost: number
  transportAirportHotelCost: number
  transportHotelStadiumCost: number
  createdAt: string
  updatedAt: string
}

export interface Event {
  id: string
  editionId: string
  name: string
  discipline: string
  gender: Gender
  perfType: PerfType
  maxSlots: number
  intMinima: number
  swissMinima: number
  eapMinima: number | null
  meetRecord: string | null
  targetPerf: string | null
  swissQuota: number
  eapQuota: number
  prize1st: number
  prize2nd: number
  prize3rd: number
  createdAt: string
}

export interface Athlete {
  id: string
  userId: string | null
  managerId: string | null
  editionId: string | null
  firstName: string
  lastName: string
  dateOfBirth: string | null
  nationality: string
  gender: Gender
  federation: string | null
  isEap: boolean
  isSwiss: boolean
  distanceFromGva: number
  waProfileUrl: string | null
  swiLicence: string | null
  honours: string | null
  eapCity: string | null
  athleteEmail: string | null
  athletePhone: string | null
  negotiationStatus: NegotiationStatus
  iRunClean: IRunCleanStatus
  dopingFree: DopingFreeStatus
  createdAt: string
  updatedAt: string
}

export interface Application {
  id: string
  athleteId: string
  eventId: string
  editionId: string
  assignedSelector: string | null
  status: NegotiationStatus // legacy — kept in DB
  participationStatus: ParticipationStatus
  personalBest: string | null
  personalBestVal: number | null
  seasonBest: string | null
  seasonBestVal: number | null
  worldRanking: number | null
  perfUpdatedAt: string | null
  estTravel: number
  estAccommodation: number
  estAppearance: number
  estTotal: number
  score: number | null
  recommendation: string | null
  hotelId: string | null
  roomNumber: string | null
  accommodationReqs: string | null
  arrivalDate: string | null
  arrivalFlight: string | null
  arrivalFrom: string | null
  arrivalTime: string | null
  departureDate: string | null
  departureFlight: string | null
  departureTo: string | null
  departureTime: string | null
  iRunClean: IRunCleanStatus // legacy — now on athlete
  dopingFree: DopingFreeStatus // legacy — now on athlete
  participantNotes: string | null
  additionalNotes: string | null
  internalNotes: string | null
  bankIban: string | null
  paymentStatus: PaymentStatus
  paymentAmount: number | null
  paymentDate: string | null
  paymentMethod: PaymentMethod | null
  appliedAt: string
  decidedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface HotelNightDays {
  tue: boolean
  wed: boolean
  thu: boolean
  fri: boolean
  sat: boolean
  sun: boolean
}

export interface ContractOffer {
  id: string
  applicationId: string // legacy
  athleteId: string | null
  version: number
  direction: OfferDirection
  bonus: number
  otherCompensation: number
  otherCompensationDesc: string | null
  transport: number
  localTransport: boolean // legacy
  transportAirportHotel: boolean
  transportHotelStadium: boolean
  hotelId: string | null
  hotelNightTue: boolean
  hotelNightWed: boolean
  hotelNightThu: boolean
  hotelNightFri: boolean
  hotelNightSat: boolean
  hotelNightSun: boolean
  dinnerTue: boolean
  dinnerWed: boolean
  dinnerThu: boolean
  dinnerFri: boolean
  dinnerSat: boolean
  dinnerSun: boolean
  stadiumMeals: boolean
  catering: number // legacy
  notes: string | null
  totalCost: number
  sentBy: string | null
  sentAt: string
  createdAt: string
}

export interface Hotel {
  id: string
  editionId: string
  name: string
  roomTypes: string | null
  costPerNight: number
  totalRooms: number
  createdAt: string
}

export interface MealOption {
  id: string
  editionId: string
  day: string
  mealType: MealType
  venue: string
  costPp: number
  capacity: number | null
  createdAt: string
}

export interface Interaction {
  id: string
  applicationId: string
  type: 'email' | 'call' | 'note' | 'status_change' | 'contract' | 'counter_offer'
  content: string
  authorId: string | null
  authorName: string
  createdAt: string
}

export interface WaPerformance {
  id: string
  athleteId: string
  eventId: string
  personalBest: string | null
  personalBestVal: number | null
  seasonBest: string | null
  seasonBestVal: number | null
  worldRanking: number | null
  updatedAt: string
  createdAt: string
}

// ── Scoring ───────────────────────────────────────────────────────────────────

export type Recommendation =
  | 'Highly Recommended'
  | 'Recommended'
  | 'Under Review'
  | 'Not Recommended'

export interface ScoreBreakdown {
  eligible: boolean
  f1PB: number
  f2SB: number
  f3Ranking: number
  f5Cost: number
  qQuota: number
  beta: number
  weightedSum: number
  finalScore: number
  recommendation: Recommendation
}

// ── API request/response helpers ──────────────────────────────────────────────

export interface ApplicationWithDetails extends Application {
  athlete: Athlete
  event: Event
  contracts: ContractOffer[]
  interactions: Interaction[]
  waPerformance?: WaPerformance | null
}
