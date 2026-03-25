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
  totalBudget: integer('total_budget').notNull().default(250_000),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

// ── Event ─────────────────────────────────────────────────────────────────────

export const event = sqliteTable('event', {
  id: text('id').primaryKey(),
  editionId: text('edition_id').notNull().references(() => edition.id),
  name: text('name').notNull(),
  discipline: text('discipline').notNull(),
  gender: text('gender').notNull(),
  perfType: text('perf_type').notNull(),
  maxSlots: integer('max_slots').notNull().default(8),
  intMinima: real('int_minima').notNull(),
  swissMinima: real('swiss_minima').notNull(),
  eapMinima: real('eap_minima'),
  meetRecord: text('meet_record'),
  targetPerf: text('target_perf'),
  swissQuota: integer('swiss_quota').notNull().default(1),
  eapQuota: integer('eap_quota').notNull().default(1),
  prize1st: integer('prize_1st').default(0),
  prize2nd: integer('prize_2nd').default(0),
  prize3rd: integer('prize_3rd').default(0),
  createdAt: createdAt(),
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
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  dateOfBirth: text('date_of_birth'),
  nationality: text('nationality').notNull(),
  gender: text('gender').notNull(),
  federation: text('federation'),
  isEap: integer('is_eap', { mode: 'boolean' }).notNull().default(false),
  isSwiss: integer('is_swiss', { mode: 'boolean' }).notNull().default(false),
  distanceFromGva: integer('distance_from_gva').default(0),
  waProfileUrl: text('wa_profile_url'),
  swiLicence: text('swi_licence'),
  honours: text('honours'),
  eapCity: text('eap_city'),
  athleteEmail: text('athlete_email'),
  athletePhone: text('athlete_phone'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

// ── Application ───────────────────────────────────────────────────────────────

export const application = sqliteTable('application', {
  id: id(),
  athleteId: text('athlete_id').notNull().references(() => athlete.id),
  eventId: text('event_id').notNull().references(() => event.id),
  editionId: text('edition_id').notNull().references(() => edition.id),
  assignedSelector: text('assigned_selector').references(() => user.id),
  status: text('status').notNull().default('to_review'),
  personalBest: text('personal_best'),
  personalBestVal: real('personal_best_val'),
  seasonBest: text('season_best'),
  seasonBestVal: real('season_best_val'),
  worldRanking: integer('world_ranking'),
  perfUpdatedAt: text('perf_updated_at'),
  estTravel: integer('est_travel').default(0),
  estAccommodation: integer('est_accommodation').default(0),
  estAppearance: integer('est_appearance').default(0),
  estTotal: integer('est_total').default(0),
  score: real('score'),
  recommendation: text('recommendation'),
  hotelId: text('hotel_id').references(() => hotel.id),
  roomNumber: text('room_number'),
  accommodationReqs: text('accommodation_reqs'),
  arrivalDate: text('arrival_date'),
  arrivalFlight: text('arrival_flight'),
  arrivalFrom: text('arrival_from'),
  arrivalTime: text('arrival_time'),
  departureDate: text('departure_date'),
  departureFlight: text('departure_flight'),
  departureTo: text('departure_to'),
  departureTime: text('departure_time'),
  iRunClean: text('i_run_clean').default('unknown'),
  dopingFree: text('doping_free').default('unknown'),
  participantNotes: text('participant_notes'),
  additionalNotes: text('additional_notes'),
  internalNotes: text('internal_notes'),
  bankIban: text('bank_iban'),
  paymentStatus: text('payment_status').default('pending'),
  paymentAmount: integer('payment_amount'),
  paymentDate: text('payment_date'),
  paymentMethod: text('payment_method'),
  appliedAt: text('applied_at').notNull().default(sql`(datetime('now'))`),
  decidedAt: text('decided_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

// ── Contract Offer ────────────────────────────────────────────────────────────

export const contractOffer = sqliteTable('contract_offer', {
  id: id(),
  applicationId: text('application_id').notNull().references(() => application.id),
  version: integer('version').notNull().default(1),
  direction: text('direction').notNull(),
  bonus: integer('bonus').notNull().default(0),
  otherCompensation: integer('other_compensation').default(0),
  transport: integer('transport').notNull().default(0),
  localTransport: integer('local_transport', { mode: 'boolean' }).notNull().default(false),
  hotelNightTue: integer('hotel_night_tue', { mode: 'boolean' }).notNull().default(false),
  hotelNightWed: integer('hotel_night_wed', { mode: 'boolean' }).notNull().default(false),
  hotelNightThu: integer('hotel_night_thu', { mode: 'boolean' }).notNull().default(false),
  hotelNightFri: integer('hotel_night_fri', { mode: 'boolean' }).notNull().default(false),
  hotelNightSat: integer('hotel_night_sat', { mode: 'boolean' }).notNull().default(false),
  hotelNightSun: integer('hotel_night_sun', { mode: 'boolean' }).notNull().default(false),
  catering: integer('catering').notNull().default(0),
  notes: text('notes'),
  totalCost: integer('total_cost').notNull().default(0),
  sentBy: text('sent_by').references(() => user.id),
  sentAt: text('sent_at').notNull().default(sql`(datetime('now'))`),
  createdAt: createdAt(),
})

// ── Hotel ─────────────────────────────────────────────────────────────────────

export const hotel = sqliteTable('hotel', {
  id: id(),
  editionId: text('edition_id').notNull().references(() => edition.id),
  name: text('name').notNull(),
  roomTypes: text('room_types'),
  costPerNight: integer('cost_per_night').notNull().default(0),
  totalRooms: integer('total_rooms').notNull().default(0),
  createdAt: createdAt(),
})

// ── Meal Option ───────────────────────────────────────────────────────────────

export const mealOption = sqliteTable('meal_option', {
  id: id(),
  editionId: text('edition_id').notNull().references(() => edition.id),
  day: text('day').notNull(),
  mealType: text('meal_type').notNull(),
  venue: text('venue').notNull(),
  costPp: integer('cost_pp').notNull().default(0),
  capacity: integer('capacity'),
  createdAt: createdAt(),
})

// ── Meal Booking ──────────────────────────────────────────────────────────────

export const mealBooking = sqliteTable('meal_booking', {
  id: id(),
  applicationId: text('application_id').notNull().references(() => application.id),
  mealOptionId: text('meal_option_id').notNull().references(() => mealOption.id),
  createdAt: createdAt(),
})

// ── Interaction ───────────────────────────────────────────────────────────────

export const interaction = sqliteTable('interaction', {
  id: id(),
  applicationId: text('application_id').notNull().references(() => application.id),
  type: text('type').notNull(),
  content: text('content').notNull(),
  authorId: text('author_id').references(() => user.id),
  authorName: text('author_name').notNull(),
  createdAt: createdAt(),
})

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
  createdAt: createdAt(),
})
