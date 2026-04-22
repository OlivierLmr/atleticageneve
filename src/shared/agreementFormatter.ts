import type { Agreement } from './types'

type Lang = 'en' | 'fr'

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

function formatDate(dateStr: string, lang: Lang): string {
  const d = new Date(dateStr)
  const day = d.getUTCDate()
  const month = lang === 'fr' ? MONTHS_FR[d.getUTCMonth()] : MONTHS_EN[d.getUTCMonth()]
  const year = d.getUTCFullYear()
  return `${day} ${month} ${year}`
}

function formatAmount(amount: number, lang: Lang): string {
  const sep = lang === 'fr' ? "'" : ','
  const formatted = Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, sep)
  return `CHF ${formatted}`
}

const DAY_LABELS: Record<Lang, Record<string, string>> = {
  en: { tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' },
  fr: { tue: 'mardi', wed: 'mercredi', thu: 'jeudi', fri: 'vendredi', sat: 'samedi', sun: 'dimanche' },
}

function getActiveDays(
  values: { tue: boolean; wed: boolean; thu: boolean; fri: boolean; sat: boolean; sun: boolean },
  lang: Lang,
): string[] {
  const labels = DAY_LABELS[lang]
  return (['tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const)
    .filter(k => values[k])
    .map(k => labels[k])
}

export interface AgreementWithHotel extends Agreement {
  hotelName?: string | null
  hotelRoomType?: string | null
}

export function formatAgreementTerms(
  agreement: AgreementWithHotel,
  selectedEventNames: string[],
  meetingName: string,
  lang: Lang,
): string {
  const colon = lang === 'fr' ? ' :' : ':'

  const title = lang === 'fr' ? "Accord d'invitation" : 'Invitation Agreement'
  const sentDateStr = formatDate(agreement.sentAt, lang)

  const lines: string[] = []

  lines.push(`${title} — version ${agreement.version}`)
  lines.push(`${meetingName} · ${sentDateStr}`)
  lines.push('')

  const eventsLabel = lang === 'fr' ? 'Épreuves sélectionnées' : 'Selected events'
  lines.push(`${eventsLabel}${colon}`)
  for (const name of selectedEventNames) {
    lines.push(`  • ${name}`)
  }

  const terms: string[] = []

  if (agreement.appearanceFee > 0) {
    const label = lang === 'fr' ? 'Cachet de participation' : 'Appearance fee'
    terms.push(`${label}${colon} ${formatAmount(agreement.appearanceFee, lang)}`)
  }

  if (agreement.otherCompensation > 0) {
    const baseLabel = lang === 'fr' ? 'Autre compensation' : 'Other compensation'
    const label = agreement.otherCompensationDesc
      ? `${baseLabel} (${agreement.otherCompensationDesc})`
      : baseLabel
    terms.push(`${label}${colon} ${formatAmount(agreement.otherCompensation, lang)}`)
  }

  if (agreement.transport > 0) {
    const label = lang === 'fr' ? 'Indemnité forfaitaire de transport' : 'Flat-rate transport allowance'
    terms.push(`${label}${colon} ${formatAmount(agreement.transport, lang)}`)
  }

  if (agreement.transportAirportHotel) {
    const label = lang === 'fr' ? 'Transport aéroport → hôtel' : 'Airport → hotel transfer'
    const value = lang === 'fr' ? 'inclus' : 'included'
    terms.push(`${label}${colon} ${value}`)
  }

  if (agreement.transportHotelStadium) {
    const label = lang === 'fr' ? 'Transport hôtel → stade' : 'Hotel → stadium transfer'
    const value = lang === 'fr' ? 'inclus' : 'included'
    terms.push(`${label}${colon} ${value}`)
  }

  const nightDays = getActiveDays({
    tue: agreement.hotelNightTue,
    wed: agreement.hotelNightWed,
    thu: agreement.hotelNightThu,
    fri: agreement.hotelNightFri,
    sat: agreement.hotelNightSat,
    sun: agreement.hotelNightSun,
  }, lang)

  const dinnerDays = getActiveDays({
    tue: agreement.dinnerTue,
    wed: agreement.dinnerWed,
    thu: agreement.dinnerThu,
    fri: agreement.dinnerFri,
    sat: agreement.dinnerSat,
    sun: agreement.dinnerSun,
  }, lang)

  if (nightDays.length > 0 || dinnerDays.length > 0) {
    const hospiLabel = lang === 'fr' ? 'Hospitalité' : 'Hospitality'
    const hotelPart = agreement.hotelName ? ` — ${agreement.hotelName}` : ''
    terms.push(`${hospiLabel}${hotelPart}${colon}`)

    if (nightDays.length > 0) {
      const n = nightDays.length
      const nightsStr = lang === 'fr'
        ? `${n} nuit${n > 1 ? 's' : ''}`
        : `${n} night${n > 1 ? 's' : ''}`
      const roomPart = agreement.hotelRoomType
        ? (lang === 'fr' ? ` — chambre ${agreement.hotelRoomType}` : ` — ${agreement.hotelRoomType} room`)
        : ''
      const accomLabel = lang === 'fr' ? 'Hébergement' : 'Accommodation'
      terms.push(`    - ${accomLabel}${colon} ${nightsStr} (${nightDays.join(', ')})${roomPart}`)
    }

    if (dinnerDays.length > 0) {
      const n = dinnerDays.length
      const dinnersStr = lang === 'fr'
        ? `${n} dîner${n > 1 ? 's' : ''}`
        : `${n} dinner${n > 1 ? 's' : ''}`
      const dinnersLabel = lang === 'fr' ? 'Dîners' : 'Dinners'
      terms.push(`    - ${dinnersLabel}${colon} ${dinnersStr} (${dinnerDays.join(', ')})`)
    }
  }

  if (agreement.stadiumMeals) {
    const label = lang === 'fr' ? 'Repas au stade' : 'Stadium meals'
    const value = lang === 'fr' ? 'inclus' : 'included'
    terms.push(`${label}${colon} ${value}`)
  }

  if (terms.length > 0) {
    lines.push('')
    const termsLabel = lang === 'fr' ? "Conditions de l'accord" : 'Agreement terms'
    lines.push(`${termsLabel}${colon}`)
    for (const term of terms) {
      if (term.startsWith('    -')) {
        lines.push(term)
      } else {
        lines.push(`  • ${term}`)
      }
    }
  }

  if (agreement.notes) {
    lines.push('')
    lines.push(`Note${colon} ${agreement.notes}`)
  }

  return lines.join('\n')
}
