import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

const id = () => text('id').primaryKey().$defaultFn(() => crypto.randomUUID())
const createdAt = () => text('created_at').notNull().default(sql`(datetime('now'))`)
const updatedAt = () => text('updated_at').notNull().default(sql`(datetime('now'))`)

// ── Edition ───────────────────────────────────────────────────────────────────

export const edition = sqliteTable('edition', {
  id: id(),
  name: text('name').notNull(),
  year: integer('year').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  currency: text('currency').notNull().default('CHF'),
  totalBudget: integer('total_budget').notNull().default(250_000),
  stadiumMealCost: integer('stadium_meal_cost').notNull().default(30),
  transportAirportHotelCost: integer('transport_airport_hotel_cost').notNull().default(50),
  transportHotelStadiumCost: integer('transport_hotel_stadium_cost').notNull().default(30),
  notificationEmail: text('notification_email').notNull(),
  weightPB: integer('weight_pb').notNull().default(25),
  weightSB: integer('weight_sb').notNull().default(35),
  weightRanking: integer('weight_ranking').notNull().default(30),
  weightCost: integer('weight_cost').notNull().default(10),
  bonusEap: integer('bonus_eap').notNull().default(5),
  managerTierBonus: integer('manager_tier_bonus').notNull().default(1),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

// ── Event Catalog ─────────────────────────────────────────────────────────────

export const eventCatalog = sqliteTable('event_catalog', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  discipline: text('discipline').notNull(),
  gender: text('gender').notNull(),
})

// ── Event ─────────────────────────────────────────────────────────────────────

export const event = sqliteTable('event', {
  id: text('id').primaryKey(),
  editionId: text('edition_id').notNull().references(() => edition.id),
  catalogId: text('catalog_id').notNull().references(() => eventCatalog.id),
  maxSlots: integer('max_slots').notNull().default(8),
  intMinima: real('int_minima').notNull(),
  swissMinima: real('swiss_minima').notNull(),
  eapMinima: real('eap_minima'),
  meetRecord: real('meet_record'),
  targetPerf: real('target_perf'),
  swissQuota: integer('swiss_quota').notNull().default(1),
  eapQuota: integer('eap_quota').notNull().default(1),
  prizeMoney1st: integer('prize_money_1st').notNull().default(0),
  prizeMoney2nd: integer('prize_money_2nd').notNull().default(0),
  prizeMoney3rd: integer('prize_money_3rd').notNull().default(0),
  prizeMoney4th: integer('prize_money_4th').notNull().default(0),
  prizeMoney5th: integer('prize_money_5th').notNull().default(0),
  prizeMoney6th: integer('prize_money_6th').notNull().default(0),
  prizeMoney7th: integer('prize_money_7th').notNull().default(0),
  prizeMoney8th: integer('prize_money_8th').notNull().default(0),
  createdAt: createdAt(),
})

// ── Country ───────────────────────────────────────────────────────────────────

export const country = sqliteTable('country', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  distanceFromGva: integer('distance_from_gva').notNull().default(0),
})

// ── EAP City ──────────────────────────────────────────────────────────────────

export const eapCity = sqliteTable('eap_city', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  countryCode: text('country_code').notNull().references(() => country.code),
})

// ── User ──────────────────────────────────────────────────────────────────────

export const user = sqliteTable('user', {
  id: id(),
  role: text('role').notNull(),
  email: text('email'),
  phone: text('phone'),
  username: text('username'),
  passwordHash: text('password_hash'),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  organization: text('organization'),
  preferredLang: text('preferred_lang').notNull().default('en'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex('idx_user_email').on(table.email),
  uniqueIndex('idx_user_username').on(table.username),
])

// ── Athlete ───────────────────────────────────────────────────────────────────

export const athlete = sqliteTable('athlete', {
  id: id(),
  userId: text('user_id').references(() => user.id),
  managerId: text('manager_id').references(() => user.id),
  editionId: text('edition_id').references(() => edition.id),
  assignedSelector: text('assigned_selector').references(() => user.id),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  dateOfBirth: text('date_of_birth'),
  nationality: text('nationality').notNull(),
  gender: text('gender').notNull(),
  federation: text('federation'),
  isEap: integer('is_eap', { mode: 'boolean' }).notNull().default(false),
  isSwiss: integer('is_swiss', { mode: 'boolean' }).notNull().default(false),
  distanceFromGva: integer('distance_from_gva').notNull().default(0),
  waProfileUrl: text('wa_profile_url'),
  swiLicence: text('swi_licence'),
  honours: text('honours'),
  eapCity: text('eap_city').references(() => eapCity.id),
  club: text('club'),
  athleteEmail: text('athlete_email'),
  athletePhone: text('athlete_phone'),
  negotiationStatus: text('negotiation_status').notNull().default('to_review'),
  decidedAt: text('decided_at'),
  iRunClean: text('i_run_clean').notNull().default('unknown'),
  dopingFree: text('doping_free').notNull().default('unknown'),
  accommodationReqs: text('accommodation_reqs'),
  arrivalDate: text('arrival_date'),
  arrivalFlight: text('arrival_flight'),
  arrivalFrom: text('arrival_from'),
  arrivalTime: text('arrival_time'),
  departureDate: text('departure_date'),
  departureFlight: text('departure_flight'),
  departureTo: text('departure_to'),
  departureTime: text('departure_time'),
  estTravel: integer('est_travel').notNull().default(0),
  estAccommodation: integer('est_accommodation').notNull().default(0),
  estAppearance: integer('est_appearance').notNull().default(0),
  estTotal: integer('est_total').notNull().default(0),
  bankIban: text('bank_iban'),
  paymentStatus: text('payment_status').notNull().default('pending'),
  paymentAmount: integer('payment_amount'),
  paymentDate: text('payment_date'),
  paymentMethod: text('payment_method'),
  participantNotes: text('participant_notes'),
  additionalNotes: text('additional_notes'),
  internalNotes: text('internal_notes'),
  archivedAt: text('archived_at'),
  updatedBy: text('updated_by').references(() => user.id),
  updatedAt: updatedAt(),
  createdAt: createdAt(),
})

// ── Application ───────────────────────────────────────────────────────────────

export const application = sqliteTable('application', {
  id: id(),
  athleteId: text('athlete_id').notNull().references(() => athlete.id),
  eventId: text('event_id').notNull().references(() => event.id),
  editionId: text('edition_id').notNull().references(() => edition.id),
  participationStatus: text('participation_status').notNull().default('pending'),
  personalBest: real('personal_best'),
  seasonBest: real('season_best'),
  worldRanking: integer('world_ranking'),
  score: real('score'),
  recommendation: text('recommendation'),
  appliedAt: text('applied_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex('idx_application_athlete_event_edition').on(table.athleteId, table.eventId, table.editionId),
])

// ── Hotel ─────────────────────────────────────────────────────────────────────

export const hotel = sqliteTable('hotel', {
  id: id(),
  editionId: text('edition_id').notNull().references(() => edition.id),
  name: text('name').notNull(),
  createdAt: createdAt(),
})

// ── Hotel Room ────────────────────────────────────────────────────────────────

export const hotelRoom = sqliteTable('hotel_room', {
  id: id(),
  hotelId: text('hotel_id').notNull().references(() => hotel.id),
  roomType: text('room_type').notNull(),
  costPerNight: integer('cost_per_night').notNull().default(0),
  dinnerCost: integer('dinner_cost').notNull().default(0),
  reservedRooms: integer('reserved_rooms').notNull().default(0),
})

// ── Agreement ─────────────────────────────────────────────────────────────────

export const agreement = sqliteTable('agreement', {
  id: id(),
  athleteId: text('athlete_id').notNull().references(() => athlete.id),
  version: integer('version').notNull().default(1),
  direction: text('direction').notNull(),
  appearanceFee: integer('appearance_fee').notNull().default(0),
  otherCompensation: integer('other_compensation').notNull().default(0),
  otherCompensationDesc: text('other_compensation_desc'),
  transport: integer('transport').notNull().default(0),
  transportAirportHotel: integer('transport_airport_hotel', { mode: 'boolean' }).notNull().default(false),
  transportHotelStadium: integer('transport_hotel_stadium', { mode: 'boolean' }).notNull().default(false),
  hotelRoomId: text('hotel_room_id').references(() => hotelRoom.id),
  hotelNightTue: integer('hotel_night_tue', { mode: 'boolean' }).notNull().default(false),
  hotelNightWed: integer('hotel_night_wed', { mode: 'boolean' }).notNull().default(false),
  hotelNightThu: integer('hotel_night_thu', { mode: 'boolean' }).notNull().default(false),
  hotelNightFri: integer('hotel_night_fri', { mode: 'boolean' }).notNull().default(false),
  hotelNightSat: integer('hotel_night_sat', { mode: 'boolean' }).notNull().default(false),
  hotelNightSun: integer('hotel_night_sun', { mode: 'boolean' }).notNull().default(false),
  dinnerTue: integer('dinner_tue', { mode: 'boolean' }).notNull().default(false),
  dinnerWed: integer('dinner_wed', { mode: 'boolean' }).notNull().default(false),
  dinnerThu: integer('dinner_thu', { mode: 'boolean' }).notNull().default(false),
  dinnerFri: integer('dinner_fri', { mode: 'boolean' }).notNull().default(false),
  dinnerSat: integer('dinner_sat', { mode: 'boolean' }).notNull().default(false),
  dinnerSun: integer('dinner_sun', { mode: 'boolean' }).notNull().default(false),
  stadiumMeals: integer('stadium_meals', { mode: 'boolean' }).notNull().default(false),
  notes: text('notes'),
  totalCost: integer('total_cost').notNull().default(0),
  sentBy: text('sent_by').references(() => user.id),
  sentAt: text('sent_at').notNull().default(sql`(datetime('now'))`),
  createdAt: createdAt(),
})

// ── Interaction ───────────────────────────────────────────────────────────────

export const interaction = sqliteTable('interaction', {
  id: id(),
  athleteId: text('athlete_id').notNull().references(() => athlete.id),
  applicationId: text('application_id').references(() => application.id),
  type: text('type').notNull(),
  content: text('content').notNull(),
  authorId: text('author_id').references(() => user.id),
  authorName: text('author_name').notNull(),
  emailLogId: text('email_log_id').references(() => emailLog.id),
  createdAt: createdAt(),
})

// ── Email Log ─────────────────────────────────────────────────────────────────

export const emailLog = sqliteTable('email_log', {
  id: id(),
  to: text('to').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  htmlBody: text('html_body'),
  lang: text('lang').notNull(),
  sentAt: text('sent_at').notNull().default(sql`(datetime('now'))`),
  relatedAthleteId: text('related_athlete_id').references(() => athlete.id),
})

// ── WA Performance ────────────────────────────────────────────────────────────

export const waPerformance = sqliteTable('wa_performance', {
  id: id(),
  athleteId: text('athlete_id').notNull().references(() => athlete.id),
  eventId: text('event_id').notNull().references(() => event.id),
  personalBest: real('personal_best'),
  seasonBest: real('season_best'),
  worldRanking: integer('world_ranking'),
}, (table) => [
  uniqueIndex('idx_wa_perf_athlete_event').on(table.athleteId, table.eventId),
])

// ── Session ───────────────────────────────────────────────────────────────────

export const session = sqliteTable('session', {
  id: id(),
  userId: text('user_id').notNull().references(() => user.id),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdAt: createdAt(),
})

// ── Magic Link ────────────────────────────────────────────────────────────────

export const magicLink = sqliteTable('magic_link', {
  id: id(),
  userId: text('user_id').notNull().references(() => user.id),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  used: integer('used', { mode: 'boolean' }).notNull().default(false),
  redirectUrl: text('redirect_url'),
  createdAt: createdAt(),
})

// ── Cost Tier Config ──────────────────────────────────────────────────────────

export const costTierConfig = sqliteTable('cost_tier_config', {
  id: id(),
  editionId: text('edition_id').notNull().references(() => edition.id),
  tier: integer('tier').notNull(),
  rankingMin: integer('ranking_min'),
  rankingMax: integer('ranking_max'),
  appearanceFee: integer('appearance_fee').notNull().default(0),
  nightlyRate: integer('nightly_rate').notNull().default(0),
})

// ── Cost Distance Config ──────────────────────────────────────────────────────

export const costDistanceConfig = sqliteTable('cost_distance_config', {
  id: id(),
  editionId: text('edition_id').notNull().references(() => edition.id),
  distanceMax: integer('distance_max'),
  travelCost: integer('travel_cost').notNull().default(0),
  nights: integer('nights').notNull().default(0),
})
