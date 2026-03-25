import { Hono } from 'hono'
import { eq, sql } from 'drizzle-orm'
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

  // Get all applications
  const applications = await db.select().from(schema.application)

  // Get all events
  const events = await db
    .select()
    .from(schema.event)
    .where(eq(schema.event.editionId, edition.id))

  // Get all athletes
  const athletes = await db.select().from(schema.athlete)

  // Get all contract offers
  const contracts = await db.select().from(schema.contractOffer)

  // Get all collaborators
  const collaborators = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.role, 'collaborator'))

  // ── Top-level KPIs ─────────────────────────────────────────────────────

  const totalApplications = applications.length
  const confirmed = applications.filter((a) => a.status === 'accepted').length
  const inNegotiation = applications.filter((a) =>
    ['contract_sent', 'counter_offer'].includes(a.status)
  ).length
  const toReview = applications.filter((a) => a.status === 'to_review').length
  const rejected = applications.filter((a) => a.status === 'rejected').length
  const withdrawn = applications.filter((a) => a.status === 'withdrawn').length

  // Budget: sum estTotal for accepted + in-negotiation applications
  const budgetCommitted = applications
    .filter((a) => a.status === 'accepted')
    .reduce((sum, a) => sum + (a.estTotal ?? 0), 0)

  const budgetInNegotiation = applications
    .filter((a) => ['contract_sent', 'counter_offer'].includes(a.status))
    .reduce((sum, a) => sum + (a.estTotal ?? 0), 0)

  const totalBudget = edition.totalBudget
  const budgetRemaining = totalBudget - budgetCommitted

  // ── Event fill rates ───────────────────────────────────────────────────

  const eventStats = events.map((evt) => {
    const eventApps = applications.filter((a) => a.eventId === evt.id)
    const eventAthletes = eventApps.map((a) => athletes.find((ath) => ath.id === a.athleteId))

    const confirmedCount = eventApps.filter((a) => a.status === 'accepted').length
    const negotiatingCount = eventApps.filter((a) =>
      ['contract_sent', 'counter_offer'].includes(a.status)
    ).length
    const reviewCount = eventApps.filter((a) => a.status === 'to_review').length

    // Swiss quota tracking
    const swissConfirmed = eventApps
      .filter((a) => a.status === 'accepted')
      .filter((a) => {
        const ath = eventAthletes.find((at) => at?.id === a.athleteId)
        return ath?.isSwiss
      }).length

    // EAP quota tracking
    const eapConfirmed = eventApps
      .filter((a) => a.status === 'accepted')
      .filter((a) => {
        const ath = eventAthletes.find((at) => at?.id === a.athleteId)
        return ath?.isEap
      }).length

    const eventBudget = eventApps
      .filter((a) => a.status === 'accepted')
      .reduce((sum, a) => sum + (a.estTotal ?? 0), 0)

    return {
      eventId: evt.id,
      eventName: evt.name,
      gender: evt.gender,
      maxSlots: evt.maxSlots,
      confirmed: confirmedCount,
      negotiating: negotiatingCount,
      toReview: reviewCount,
      total: eventApps.length,
      fillRate: evt.maxSlots > 0 ? confirmedCount / evt.maxSlots : 0,
      swissQuota: evt.swissQuota,
      swissConfirmed,
      eapQuota: evt.eapQuota,
      eapConfirmed,
      budget: eventBudget,
    }
  })

  // ── Selector workload ──────────────────────────────────────────────────

  const selectorStats = collaborators.map((collab) => {
    const assigned = applications.filter((a) => a.assignedSelector === collab.id)
    return {
      selectorId: collab.id,
      name: `${collab.firstName} ${collab.lastName}`,
      total: assigned.length,
      toReview: assigned.filter((a) => a.status === 'to_review').length,
      inNegotiation: assigned.filter((a) =>
        ['contract_sent', 'counter_offer'].includes(a.status)
      ).length,
      confirmed: assigned.filter((a) => a.status === 'accepted').length,
    }
  })

  // ── Cost breakdown ─────────────────────────────────────────────────────

  const acceptedApps = applications.filter((a) => a.status === 'accepted')
  const costBreakdown = {
    travel: acceptedApps.reduce((sum, a) => sum + (a.estTravel ?? 0), 0),
    accommodation: acceptedApps.reduce((sum, a) => sum + (a.estAccommodation ?? 0), 0),
    appearance: acceptedApps.reduce((sum, a) => sum + (a.estAppearance ?? 0), 0),
    total: budgetCommitted,
  }

  return c.json({
    edition: {
      name: edition.name,
      year: edition.year,
      startDate: edition.startDate,
      endDate: edition.endDate,
      totalBudget,
    },
    kpi: {
      totalApplications,
      confirmed,
      inNegotiation,
      toReview,
      rejected,
      withdrawn,
      budgetCommitted,
      budgetInNegotiation,
      budgetRemaining,
    },
    events: eventStats,
    selectors: selectorStats,
    costBreakdown,
  })
})

export default dashboard
