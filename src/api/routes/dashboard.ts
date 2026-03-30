import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
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
  const applications = await db.select().from(schema.application)
  const events = await db.select().from(schema.event).where(eq(schema.event.editionId, edition.id))
  const athletes = await db.select().from(schema.athlete)
  const contracts = await db.select().from(schema.contractOffer)
  const collaborators = await db.select().from(schema.user).where(eq(schema.user.role, 'collaborator'))

  // ── Top-level KPIs (athlete-level, deduplicated) ─────────────────────
  const editionAthletes = athletes.filter(a => a.editionId === edition.id)

  const totalAthletes = editionAthletes.length
  const confirmed = editionAthletes.filter((a) => a.negotiationStatus === 'accepted').length
  const inNegotiation = editionAthletes.filter((a) =>
    ['contract_sent', 'counter_offer'].includes(a.negotiationStatus)
  ).length
  const toReview = editionAthletes.filter((a) => a.negotiationStatus === 'to_review').length
  const rejected = editionAthletes.filter((a) => a.negotiationStatus === 'rejected').length
  const withdrawn = editionAthletes.filter((a) => a.negotiationStatus === 'withdrawn').length

  // Budget: sum totalCost of latest contracts for accepted athletes
  const latestContracts = new Map<string, typeof contracts[0]>()
  for (const co of contracts) {
    if (!co.athleteId) continue
    const existing = latestContracts.get(co.athleteId)
    if (!existing || co.version > existing.version) {
      latestContracts.set(co.athleteId, co)
    }
  }

  const budgetCommitted = editionAthletes
    .filter(a => a.negotiationStatus === 'accepted')
    .reduce((sum, a) => {
      const co = latestContracts.get(a.id)
      return sum + (co?.totalCost ?? 0)
    }, 0)

  const budgetInNegotiation = editionAthletes
    .filter(a => ['contract_sent', 'counter_offer'].includes(a.negotiationStatus))
    .reduce((sum, a) => {
      const co = latestContracts.get(a.id)
      return sum + (co?.totalCost ?? 0)
    }, 0)

  const totalBudget = edition.totalBudget
  const budgetRemaining = totalBudget - budgetCommitted

  // ── Event fill rates (based on participationStatus) ──────────────────

  const eventStats = events.map((evt) => {
    const eventApps = applications.filter((a) => a.eventId === evt.id)
    const eventAthletes = eventApps.map((a) => athletes.find((ath) => ath.id === a.athleteId))

    const selectedCount = eventApps.filter((a) => a.participationStatus === 'selected').length
    const pendingCount = eventApps.filter((a) => a.participationStatus === 'pending').length
    const notSelectedCount = eventApps.filter((a) => a.participationStatus === 'not_selected').length

    // Swiss quota tracking
    const swissSelected = eventApps
      .filter((a) => a.participationStatus === 'selected')
      .filter((a) => {
        const ath = eventAthletes.find((at) => at?.id === a.athleteId)
        return ath?.isSwiss
      }).length

    // EAP quota tracking
    const eapSelected = eventApps
      .filter((a) => a.participationStatus === 'selected')
      .filter((a) => {
        const ath = eventAthletes.find((at) => at?.id === a.athleteId)
        return ath?.isEap
      }).length

    return {
      eventId: evt.id,
      eventName: evt.name,
      gender: evt.gender,
      maxSlots: evt.maxSlots,
      selected: selectedCount,
      pending: pendingCount,
      notSelected: notSelectedCount,
      total: eventApps.length,
      fillRate: evt.maxSlots > 0 ? selectedCount / evt.maxSlots : 0,
      swissQuota: evt.swissQuota,
      swissSelected,
      eapQuota: evt.eapQuota,
      eapSelected,
    }
  })

  // ── Selector workload ────────────────────────────────────────────────

  const selectorStats = collaborators.map((collab) => {
    const assignedApps = applications.filter((a) => a.assignedSelector === collab.id)
    const assignedAthleteIds = [...new Set(assignedApps.map(a => a.athleteId))]
    const assignedAthletes = assignedAthleteIds.map(id => athletes.find(a => a.id === id)).filter(Boolean)

    return {
      selectorId: collab.id,
      name: `${collab.firstName} ${collab.lastName}`,
      total: assignedAthletes.length,
      toReview: assignedAthletes.filter((a) => a!.negotiationStatus === 'to_review').length,
      inNegotiation: assignedAthletes.filter((a) =>
        ['contract_sent', 'counter_offer'].includes(a!.negotiationStatus)
      ).length,
      confirmed: assignedAthletes.filter((a) => a!.negotiationStatus === 'accepted').length,
    }
  })

  return c.json({
    edition: {
      name: edition.name,
      year: edition.year,
      startDate: edition.startDate,
      endDate: edition.endDate,
      totalBudget,
    },
    kpi: {
      totalAthletes,
      totalApplications: applications.length,
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
  })
})

export default dashboard
