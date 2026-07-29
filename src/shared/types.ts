// ── Status enums ──────────────────────────────────────────────────────────────

export type NegotiationStatus =
  | 'to_review'
  | 'agreement_sent'
  | 'counter_offer_sent'
  | 'confirmed'
  | 'rejected'
  | 'withdrawn'

export type ParticipationStatus = 'pending' | 'selected' | 'not_selected'

export type OfferDirection = 'to_athlete' | 'to_organizer'

export type Gender = 'M' | 'F'

export type UserRole = 'athlete' | 'manager' | 'collaborator' | 'committee'

export type TravelMode = 'plane' | 'train' | 'road'

export type IRunCleanStatus = 'yes' | 'no' | 'in_progress' | 'unknown'
export type DopingFreeStatus = 'yes' | 'no' | 'unknown'
export type PaymentStatus = 'pending' | 'done'
export type PaymentMethod = 'cash' | 'bank' | 'western_union' | 'paypal' | 'other'
export type PerfType = 'MIN' | 'MAX'

export type Recommendation =
  | 'Highly Recommended'
  | 'Recommended'
  | 'Under Review'
  | 'Not Recommended'

export type InteractionType =
  | 'email'
  | 'call'
  | 'note'
  | 'status_change'
  | 'agreement'
  | 'counter_offer'
  | 'manager_notification'

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
  bankIban: string | null
  preferredLang: string
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
  currency: string
  totalBudget: number
  stadiumMealCost: number
  transportAirportHotelCost: number
  transportHotelStadiumCost: number
  notificationEmail: string
  weightPB: number
  weightSB: number
  weightRanking: number
  weightCost: number
  bonusEap: number
  managerTierBonus: number
  eaRankingThreshold: number
  createdAt: string
  updatedAt: string
}

export interface EventCatalog {
  id: string
  name: string
  discipline: string
  gender: Gender
  waName: string | null
  waRankingSlug: string | null
  eaDiscipline: string | null
}

export interface Event {
  id: string
  editionId: string
  catalogId: string
  maxSlots: number
  intMinima: number
  swissMinima: number
  eapMinima: number | null
  meetRecord: number | null
  targetPerf: number | null
  swissQuota: number
  eapQuota: number
  prizeMoney1st: number
  prizeMoney2nd: number
  prizeMoney3rd: number
  prizeMoney4th: number
  prizeMoney5th: number
  prizeMoney6th: number
  prizeMoney7th: number
  prizeMoney8th: number
  createdAt: string
}

export interface Country {
  code: string
  name: string
  distanceFromGva: number
}

export interface EapCity {
  id: string
  name: string
  countryCode: string
}

export interface Athlete {
  id: string
  userId: string | null
  managerId: string | null
  editionId: string | null
  assignedSelector: string | null
  firstName: string
  lastName: string
  dateOfBirth: string | null
  nationality: string
  gender: Gender
  federation: string | null
  club: string | null
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
  decidedAt: string | null
  iRunClean: IRunCleanStatus
  dopingFree: DopingFreeStatus
  accommodationReqs: string | null
  travelMode: TravelMode
  arrivalDate: string | null
  arrivalFlight: string | null
  arrivalFrom: string | null
  arrivalTime: string | null
  departureDate: string | null
  departureFlight: string | null
  departureTo: string | null
  departureTime: string | null
  estTravel: number
  estAccommodation: number
  estAppearance: number
  estTotal: number
  bankIban: string | null
  paymentStatus: PaymentStatus
  paymentAmount: number | null
  paymentDate: string | null
  paymentMethod: PaymentMethod | null
  participantNotes: string | null
  additionalNotes: string | null
  internalNotes: string | null
  archivedAt: string | null
  updatedBy: string | null
  updatedAt: string
  createdAt: string
}

export interface Application {
  id: string
  athleteId: string
  eventId: string
  editionId: string
  participationStatus: ParticipationStatus
  personalBest: number | null
  seasonBest: number | null
  worldRanking: number | null
  score: number | null
  recommendation: Recommendation | null
  finalPlacement: number | null
  appliedAt: string
}

export interface Agreement {
  id: string
  athleteId: string
  version: number
  direction: OfferDirection
  appearanceFee: number
  otherCompensation: number
  otherCompensationDesc: string | null
  transport: number
  transportAirportHotel: boolean
  transportHotelStadium: boolean
  hotelRoomId: string | null
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
  notes: string | null
  totalCost: number
  sentBy: string | null
  sentAt: string
  createdAt: string
  hotelName?: string | null
  hotelRoomType?: string | null
}

export interface Hotel {
  id: string
  editionId: string
  name: string
  createdAt: string
}

export interface HotelRoom {
  id: string
  hotelId: string
  roomType: string
  costPerNight: number
  dinnerCost: number
  reservedRooms: number
  negotiatingCount: number
  confirmedCount: number
}

export interface HotelNightDays {
  tue: boolean
  wed: boolean
  thu: boolean
  fri: boolean
  sat: boolean
  sun: boolean
}

export interface Interaction {
  id: string
  athleteId: string
  applicationId: string | null
  type: InteractionType
  content: string
  authorId: string | null
  authorName: string
  authorRole: UserRole
  emailLogId: string | null
  createdAt: string
}

export interface EmailLog {
  id: string
  to: string
  subject: string
  body: string
  htmlBody: string | null
  lang: string
  sentAt: string
  relatedAthleteId: string | null
}

export interface WaPerformance {
  id: string
  athleteId: string
  eventId: string
  personalBest: number | null
  seasonBest: number | null
  worldRanking: number | null
  eaRanking: number | null
}

// ── Scoring ───────────────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  eligible: boolean
  f1PB: number
  f2SB: number
  f3Ranking: number
  f4Cost: number
  eapBonus: number
  weightedSum: number
  finalScore: number
  recommendation: Recommendation
}

export interface EditionWeights {
  weightPB: number
  weightSB: number
  weightRanking: number
  weightCost: number
  bonusEap: number
}

// ── API request/response helpers ──────────────────────────────────────────────

export interface ApplicationWithDetails extends Application {
  athlete: Athlete
  event: Event
  agreements: Agreement[]
  interactions: Interaction[]
  waPerformance?: WaPerformance | null
}

export interface ApplicationForAthlete extends Application {
  event: Event & { catalog: EventCatalog }
  waPerformance: WaPerformance | null
}

export interface EditionCosts {
  name: string
  weightPB: number
  weightSB: number
  weightRanking: number
  weightCost: number
  bonusEap: number
  stadiumMealCost: number
  transportAirportHotelCost: number
  transportHotelStadiumCost: number
  eaRankingThreshold: number
}

export interface AthleteDetail extends Athlete {
  managerName: string | null
  applications: ApplicationForAthlete[]
  agreements: Agreement[]
  interactions: Interaction[]
  edition: EditionCosts | null
}

export interface CostTierConfig {
  id: string
  editionId: string
  tier: number
  rankingMin: number | null
  rankingMax: number | null
  appearanceFee: number
  nightlyRate: number
}

export interface CostDistanceConfig {
  id: string
  editionId: string
  distanceMax: number | null
  travelCost: number
  nights: number
}

// ── Payments ──────────────────────────────────────────────────────────────────

export interface PaymentEventLine {
  applicationId: string
  eventName: string
  finalPlacement: number | null
  prizeMoney: number
}

export interface PaymentEntry {
  athleteId: string
  athleteFirstName: string
  athleteLastName: string
  managerId: string | null
  managerName: string | null
  recipientName: string
  recipientEmail: string | null
  recipientIban: string | null
  appearanceFee: number
  otherCompensation: number
  otherCompensationDesc: string | null
  events: PaymentEventLine[]
  totalPrizeMoney: number
  totalDue: number
  paymentStatus: PaymentStatus
  paymentDate: string | null
  currency: string
}

// ── Results ───────────────────────────────────────────────────────────────────

export interface ResultAthleteEntry {
  applicationId: string
  athleteId: string
  athleteFirstName: string
  athleteLastName: string
  finalPlacement: number | null
  prizeMoney: number
}

export interface ResultEventEntry {
  eventId: string
  eventName: string
  prizeSlots: { place: number; amount: number }[]
  athletes: ResultAthleteEntry[]
}

export interface ResultsResponse {
  currency: string
  events: ResultEventEntry[]
}
