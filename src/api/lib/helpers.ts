import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type * as schema from '../db/schema'
import type { PerfType, EditionWeights } from '@shared/types'

// ── Shared DB type ──────────────────────────────────────────────────────────

export type Db = DrizzleD1Database<typeof schema>

// ── Role helpers ────────────────────────────────────────────────────────────

export function isStaff(role: string): boolean {
  return role === 'collaborator' || role === 'committee'
}

// ── Performance type from discipline ────────────────────────────────────────

export function perfType(discipline: string): PerfType {
  return discipline === 'Course' ? 'MIN' : 'MAX'
}

// ── Extract edition weights ─────────────────────────────────────────────────

export function editionWeights(edition: {
  weightPB: number
  weightSB: number
  weightRanking: number
  weightCost: number
  bonusEap: number
}): EditionWeights {
  return {
    weightPB: edition.weightPB,
    weightSB: edition.weightSB,
    weightRanking: edition.weightRanking,
    weightCost: edition.weightCost,
    bonusEap: edition.bonusEap,
  }
}

// ── Calculate total cost from agreement fields ──────────────────────────────

interface CostParams {
  appearanceFee: number
  otherCompensation: number
  transport: number
  transportAirportHotel: boolean
  transportHotelStadium: boolean
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
}

interface RoomCosts {
  costPerNight: number
  dinnerCost: number
}

interface EditionCosts {
  stadiumMealCost: number
  transportAirportHotelCost: number
  transportHotelStadiumCost: number
}

export function calculateTotalCost(data: CostParams, roomCosts: RoomCosts, editionCosts: EditionCosts): number {
  const nights = [
    data.hotelNightTue, data.hotelNightWed, data.hotelNightThu,
    data.hotelNightFri, data.hotelNightSat, data.hotelNightSun,
  ].filter(Boolean).length

  const dinners = [
    data.dinnerTue, data.dinnerWed, data.dinnerThu,
    data.dinnerFri, data.dinnerSat, data.dinnerSun,
  ].filter(Boolean).length

  let total = data.appearanceFee + data.otherCompensation + data.transport
  total += nights * roomCosts.costPerNight
  total += dinners * roomCosts.dinnerCost
  if (data.stadiumMeals) total += editionCosts.stadiumMealCost
  if (data.transportAirportHotel) total += editionCosts.transportAirportHotelCost
  if (data.transportHotelStadium) total += editionCosts.transportHotelStadiumCost

  return total
}
