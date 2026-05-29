import type { Hotel, HotelRoom, Application, Athlete, Event, EventCatalog, WaPerformance, Agreement } from '@shared/types'

export interface HotelWithRooms extends Hotel {
  rooms: HotelRoom[]
}

export type AgreementFormDraft = {
  appearanceFee: number | ''
  otherCompensation: number | ''
  otherCompensationDesc: string
  transport: number | ''
  transportAirportHotel: boolean
  transportHotelStadium: boolean
  hotelRoomId: string
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
  notes: string
}

export interface StaffUser {
  id: string
  firstName: string
  lastName: string
  role: string
}

export interface ApplicationRow extends Application {
  athlete: Athlete
  event: Event & { catalog: EventCatalog }
  waPerformance: WaPerformance | null
}

export interface FieldDef {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'textarea'
  options?: { value: string; label: string }[]
}

export function defaultAgreement(existing?: Agreement, athlete?: Athlete): AgreementFormDraft {
  if (existing) {
    return {
      appearanceFee: existing.appearanceFee,
      otherCompensation: existing.otherCompensation,
      otherCompensationDesc: existing.otherCompensationDesc ?? '',
      transport: existing.transport,
      transportAirportHotel: existing.transportAirportHotel,
      transportHotelStadium: existing.transportHotelStadium,
      hotelRoomId: existing.hotelRoomId ?? '',
      hotelNightTue: existing.hotelNightTue,
      hotelNightWed: existing.hotelNightWed,
      hotelNightThu: existing.hotelNightThu,
      hotelNightFri: existing.hotelNightFri,
      hotelNightSat: existing.hotelNightSat,
      hotelNightSun: existing.hotelNightSun,
      dinnerTue: existing.dinnerTue,
      dinnerWed: existing.dinnerWed,
      dinnerThu: existing.dinnerThu,
      dinnerFri: existing.dinnerFri,
      dinnerSat: existing.dinnerSat,
      dinnerSun: existing.dinnerSun,
      stadiumMeals: existing.stadiumMeals,
      notes: existing.notes ?? '',
    }
  }
  return {
    appearanceFee: athlete?.estAppearance || '',
    otherCompensation: '',
    otherCompensationDesc: '',
    transport: athlete?.estTravel || '',
    transportAirportHotel: true,
    transportHotelStadium: true,
    hotelRoomId: '',
    hotelNightTue: false,
    hotelNightWed: false,
    hotelNightThu: true,
    hotelNightFri: true,
    hotelNightSat: true,
    hotelNightSun: false,
    dinnerTue: false,
    dinnerWed: false,
    dinnerThu: true,
    dinnerFri: true,
    dinnerSat: true,
    dinnerSun: false,
    stadiumMeals: true,
    notes: '',
  }
}
