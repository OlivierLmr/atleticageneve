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

export function formatAgreementTermsHtml(
  agreement: AgreementWithHotel,
  selectedEventNames: string[],
  meetingName: string,
  lang: Lang,
): string {
  const sentDateStr = formatDate(agreement.sentAt, lang)
  const title = lang === 'fr' ? "Accord d'invitation" : 'Invitation Agreement'
  const termsLabel = lang === 'fr' ? "Conditions de l'accord" : 'Agreement terms'

  const rows: string[] = []

  const eventsLabel = lang === 'fr' ? 'Épreuves sélectionnées' : 'Selected events'
  rows.push(`<tr><td style="padding:5px 12px;font-weight:600;vertical-align:top;color:#555">${eventsLabel}</td><td style="padding:5px 12px">${selectedEventNames.join('<br/>')}</td></tr>`)

  if (agreement.appearanceFee > 0) {
    const label = lang === 'fr' ? 'Cachet de participation' : 'Appearance fee'
    rows.push(`<tr><td style="padding:5px 12px;font-weight:600;color:#555">${label}</td><td style="padding:5px 12px">${formatAmount(agreement.appearanceFee, lang)}</td></tr>`)
  }

  if (agreement.otherCompensation > 0) {
    const baseLabel = lang === 'fr' ? 'Autre compensation' : 'Other compensation'
    const label = agreement.otherCompensationDesc ? `${baseLabel} (${agreement.otherCompensationDesc})` : baseLabel
    rows.push(`<tr><td style="padding:5px 12px;font-weight:600;color:#555">${label}</td><td style="padding:5px 12px">${formatAmount(agreement.otherCompensation, lang)}</td></tr>`)
  }

  if (agreement.transport > 0) {
    const label = lang === 'fr' ? 'Indemnité de transport' : 'Transport allowance'
    rows.push(`<tr><td style="padding:5px 12px;font-weight:600;color:#555">${label}</td><td style="padding:5px 12px">${formatAmount(agreement.transport, lang)}</td></tr>`)
  }

  if (agreement.transportAirportHotel) {
    const label = lang === 'fr' ? 'Transport aéroport → hôtel' : 'Airport → hotel transfer'
    rows.push(`<tr><td style="padding:5px 12px;font-weight:600;color:#555">${label}</td><td style="padding:5px 12px">${lang === 'fr' ? 'inclus' : 'included'}</td></tr>`)
  }

  if (agreement.transportHotelStadium) {
    const label = lang === 'fr' ? 'Transport hôtel → stade' : 'Hotel → stadium transfer'
    rows.push(`<tr><td style="padding:5px 12px;font-weight:600;color:#555">${label}</td><td style="padding:5px 12px">${lang === 'fr' ? 'inclus' : 'included'}</td></tr>`)
  }

  const nightDays = getActiveDays({ tue: agreement.hotelNightTue, wed: agreement.hotelNightWed, thu: agreement.hotelNightThu, fri: agreement.hotelNightFri, sat: agreement.hotelNightSat, sun: agreement.hotelNightSun }, lang)
  const dinnerDays = getActiveDays({ tue: agreement.dinnerTue, wed: agreement.dinnerWed, thu: agreement.dinnerThu, fri: agreement.dinnerFri, sat: agreement.dinnerSat, sun: agreement.dinnerSun }, lang)

  if (nightDays.length > 0) {
    const n = nightDays.length
    const nightsStr = lang === 'fr' ? `${n} nuit${n > 1 ? 's' : ''}` : `${n} night${n > 1 ? 's' : ''}`
    const hotelPart = agreement.hotelName ? ` — ${agreement.hotelName}${agreement.hotelRoomType ? ` (${agreement.hotelRoomType})` : ''}` : ''
    const accomLabel = lang === 'fr' ? 'Hébergement' : 'Accommodation'
    rows.push(`<tr><td style="padding:5px 12px;font-weight:600;color:#555">${accomLabel}${hotelPart}</td><td style="padding:5px 12px">${nightsStr} : ${nightDays.join(', ')}</td></tr>`)
  }

  if (dinnerDays.length > 0) {
    const n = dinnerDays.length
    const dinnersStr = lang === 'fr' ? `${n} dîner${n > 1 ? 's' : ''}` : `${n} dinner${n > 1 ? 's' : ''}`
    const dinnersLabel = lang === 'fr' ? 'Dîners' : 'Dinners'
    rows.push(`<tr><td style="padding:5px 12px;font-weight:600;color:#555">${dinnersLabel}</td><td style="padding:5px 12px">${dinnersStr} : ${dinnerDays.join(', ')}</td></tr>`)
  }

  if (agreement.stadiumMeals) {
    const label = lang === 'fr' ? 'Repas au stade' : 'Stadium meals'
    rows.push(`<tr><td style="padding:5px 12px;font-weight:600;color:#555">${label}</td><td style="padding:5px 12px">${lang === 'fr' ? 'inclus' : 'included'}</td></tr>`)
  }

  const totalLabel = lang === 'fr' ? 'Total' : 'Total cost'
  rows.push(`<tr style="border-top:2px solid #ddd;background:#f9f9f9"><td style="padding:8px 12px;font-weight:700">${totalLabel}</td><td style="padding:8px 12px;font-weight:700">${formatAmount(agreement.totalCost, lang)}</td></tr>`)

  if (agreement.notes) {
    const noteLabel = 'Note'
    rows.push(`<tr><td style="padding:5px 12px;font-weight:600;color:#555">${noteLabel}</td><td style="padding:5px 12px;font-style:italic">${agreement.notes}</td></tr>`)
  }

  return `<div style="margin:16px 0"><p style="font-size:13px;color:#666;margin:0 0 6px"><strong>${title}</strong> — v${agreement.version} &middot; ${meetingName} &middot; ${sentDateStr}</p><table style="border-collapse:collapse;width:100%;border:1px solid #e0e0e0;font-size:13px"><thead><tr style="background:#f0f0f0"><th colspan="2" style="padding:7px 12px;text-align:left;font-size:12px;color:#555;border-bottom:1px solid #e0e0e0;font-weight:600;text-transform:uppercase;letter-spacing:.5px">${termsLabel}</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`
}
