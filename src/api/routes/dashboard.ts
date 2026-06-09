import { Hono } from 'hono'
import { eq, and, isNull } from 'drizzle-orm'
import * as schema from '../db/schema'
import { requireAuth } from '../middleware/auth'
import type { Env } from '../index'

const dashboard = new Hono<Env>()

dashboard.use('*', requireAuth('committee'))

// ── GET /dashboard — aggregated KPIs ─────────────────────────────────────────

dashboard.get('/', async (c) => {
  const db = c.get('db')

  // Get current edition
  const editions = await db.select().from(schema.edition).limit(1)
  if (editions.length === 0) {
    return c.json({ error: 'No edition configured' }, 404)
  }
  const edition = editions[0]

  // Get all data
  const allAthletes = await db.select().from(schema.athlete)
  const applications = await db.select().from(schema.application)
  const events = await db.select().from(schema.event).where(eq(schema.event.editionId, edition.id))
  const catalogRows = await db.select().from(schema.eventCatalog)
  const agreements = await db.select().from(schema.agreement)
  const collaborators = await db.select().from(schema.user).where(eq(schema.user.role, 'collaborator'))
  const hotelRooms = await db.select().from(schema.hotelRoom)
  const hotels = await db.select().from(schema.hotel)

  // Build catalog lookup
  const catalogMap = new Map(catalogRows.map(c => [c.id, c]))

  // ── Top-level KPIs (athlete-level, deduplicated, excluding archived) ───
  const editionAthletes = allAthletes.filter(a => a.editionId === edition.id && !a.archivedAt)

  const totalAthletes = editionAthletes.length
  const totalApplications = applications.filter(a => a.editionId === edition.id).length
  const confirmed = editionAthletes.filter(a => a.negotiationStatus === 'confirmed').length
  const inNegotiation = editionAthletes.filter(a =>
    ['agreement_sent', 'counter_offer_sent'].includes(a.negotiationStatus)
  ).length
  const toReview = editionAthletes.filter(a => a.negotiationStatus === 'to_review').length
  const rejected = editionAthletes.filter(a => a.negotiationStatus === 'rejected').length
  const withdrawn = editionAthletes.filter(a => a.negotiationStatus === 'withdrawn').length

  // Budget: sum totalCost of latest agreements per athlete
  const latestAgreements = new Map<string, typeof agreements[0]>()
  for (const ag of agreements) {
    const existing = latestAgreements.get(ag.athleteId)
    if (!existing || ag.version > existing.version) {
      latestAgreements.set(ag.athleteId, ag)
    }
  }

  const budgetCommitted = editionAthletes
    .filter(a => a.negotiationStatus === 'confirmed')
    .reduce((sum, a) => {
      const ag = latestAgreements.get(a.id)
      return sum + (ag?.totalCost ?? 0)
    }, 0)

  const budgetInNegotiation = editionAthletes
    .filter(a => ['agreement_sent', 'counter_offer_sent'].includes(a.negotiationStatus))
    .reduce((sum, a) => {
      const ag = latestAgreements.get(a.id)
      return sum + (ag?.totalCost ?? 0)
    }, 0)

  const budgetRemaining = edition.totalBudget - budgetCommitted

  // Total prize money across all events
  const totalPrizeMoney = events.reduce((sum, evt) => {
    return sum + evt.prizeMoney1st + evt.prizeMoney2nd + evt.prizeMoney3rd
      + evt.prizeMoney4th + evt.prizeMoney5th + evt.prizeMoney6th
      + evt.prizeMoney7th + evt.prizeMoney8th
  }, 0)

  // ── Event fill rates ──────────────────────────────────────────────────

  const eventStats = events.map((evt) => {
    const catalog = catalogMap.get(evt.catalogId)
    const eventApps = applications.filter(a => a.eventId === evt.id)

    // Get athletes for selected applications
    const selectedApps = eventApps.filter(a => a.participationStatus === 'selected')
    const selectedAthleteIds = selectedApps.map(a => a.athleteId)
    const selectedAthletes = editionAthletes.filter(a => selectedAthleteIds.includes(a.id))

    const confirmedSelected = selectedAthletes.filter(a => a.negotiationStatus === 'confirmed').length
    const inNegSelected = selectedAthletes.filter(a =>
      ['agreement_sent', 'counter_offer_sent'].includes(a.negotiationStatus)
    ).length

    const confirmedFillRate = evt.maxSlots > 0 ? confirmedSelected / evt.maxSlots : 0
    const negotiationFillRate = evt.maxSlots > 0 ? (confirmedSelected + inNegSelected) / evt.maxSlots : 0

    // Swiss/EAP quota tracking
    const swissSelected = selectedAthletes.filter(a => a.isSwiss).length
    const eapSelected = selectedAthletes.filter(a => a.isEap).length

    return {
      eventId: evt.id,
      eventName: catalog?.name ?? evt.id,
      discipline: catalog?.discipline ?? '',
      gender: catalog?.gender ?? '',
      maxSlots: evt.maxSlots,
      confirmedSelected,
      inNegotiationSelected: inNegSelected,
      confirmedFillRate,
      negotiationFillRate,
      swissQuota: evt.swissQuota,
      swissSelected,
      eapQuota: evt.eapQuota,
      eapSelected,
    }
  })

  // ── Hotel room occupancy ──────────────────────────────────────────────

  // Build a map of hotelRoomId -> count of confirmed / in-negotiation athletes
  const confirmedAthleteIds = new Set(editionAthletes.filter(a => a.negotiationStatus === 'confirmed').map(a => a.id))
  const inNegAthleteIds = new Set(editionAthletes.filter(a =>
    ['agreement_sent', 'counter_offer_sent'].includes(a.negotiationStatus)
  ).map(a => a.id))

  // Count rooms assigned via latest agreements
  const roomConfirmed = new Map<string, number>()
  const roomInNeg = new Map<string, number>()
  for (const [athleteId, ag] of latestAgreements) {
    if (!ag.hotelRoomId) continue
    if (confirmedAthleteIds.has(athleteId)) {
      roomConfirmed.set(ag.hotelRoomId, (roomConfirmed.get(ag.hotelRoomId) ?? 0) + 1)
    }
    if (inNegAthleteIds.has(athleteId)) {
      roomInNeg.set(ag.hotelRoomId, (roomInNeg.get(ag.hotelRoomId) ?? 0) + 1)
    }
  }

  const hotelMap = new Map(hotels.map(h => [h.id, h.name]))

  const hotelRoomStats = hotelRooms.map(room => {
    const confirmedCount = roomConfirmed.get(room.id) ?? 0
    const inNegCount = roomInNeg.get(room.id) ?? 0
    return {
      roomId: room.id,
      hotelId: room.hotelId,
      hotelName: hotelMap.get(room.hotelId) ?? '',
      roomType: room.roomType,
      reservedRooms: room.reservedRooms,
      confirmedOccupancy: room.reservedRooms > 0 ? confirmedCount / room.reservedRooms : 0,
      negotiationOccupancy: room.reservedRooms > 0 ? (confirmedCount + inNegCount) / room.reservedRooms : 0,
      confirmedCount,
      inNegotiationCount: inNegCount,
    }
  })

  // ── Selector workload ─────────────────────────────────────────────────

  const selectorStats = collaborators.map((collab) => {
    const assignedAthletes = editionAthletes.filter(a => a.assignedSelector === collab.id)

    return {
      selectorId: collab.id,
      name: `${collab.firstName} ${collab.lastName}`,
      total: assignedAthletes.length,
      toReview: assignedAthletes.filter(a => a.negotiationStatus === 'to_review').length,
      inNegotiation: assignedAthletes.filter(a =>
        ['agreement_sent', 'counter_offer_sent'].includes(a.negotiationStatus)
      ).length,
      confirmed: assignedAthletes.filter(a => a.negotiationStatus === 'confirmed').length,
      rejected: assignedAthletes.filter(a => a.negotiationStatus === 'rejected').length,
      withdrawn: assignedAthletes.filter(a => a.negotiationStatus === 'withdrawn').length,
    }
  })

  return c.json({
    edition: {
      name: edition.name,
      year: edition.year,
      startDate: edition.startDate,
      endDate: edition.endDate,
      totalBudget: edition.totalBudget,
      currency: edition.currency,
    },
    kpi: {
      totalAthletes,
      totalApplications,
      confirmed,
      inNegotiation,
      toReview,
      rejected,
      withdrawn,
      budgetCommitted,
      budgetInNegotiation,
      budgetRemaining,
      totalPrizeMoney,
    },
    events: eventStats,
    hotelRooms: hotelRoomStats,
    selectors: selectorStats,
  })
})

export default dashboard
