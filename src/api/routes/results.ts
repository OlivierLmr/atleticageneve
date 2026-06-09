import { Hono } from 'hono'
import { eq, and, isNull, inArray } from 'drizzle-orm'
import * as schema from '../db/schema'
import { requireAuth } from '../middleware/auth'
import type { Env } from '../index'
import type { ResultAthleteEntry, ResultEventEntry, ResultsResponse } from '@shared/types'

const results = new Hono<Env>()

results.use('*', requireAuth('committee'))

function getPrizeMoney(event: typeof schema.event.$inferSelect, placement: number | null): number {
  if (!placement || placement < 1 || placement > 8) return 0
  const fields: (keyof typeof schema.event.$inferSelect)[] = [
    'prizeMoney1st', 'prizeMoney2nd', 'prizeMoney3rd', 'prizeMoney4th',
    'prizeMoney5th', 'prizeMoney6th', 'prizeMoney7th', 'prizeMoney8th',
  ]
  const field = fields[placement - 1]
  return field ? (event[field] as number) ?? 0 : 0
}

// ── GET /results — events with their confirmed athletes and placements ─────────

results.get('/', async (c) => {
  const db = c.get('db')

  const editions = await db.select().from(schema.edition).limit(1)
  const edition = editions[0]
  if (!edition) return c.json({ currency: 'CHF', events: [] } )

  const currency = edition.currency ?? 'CHF'

  const eventRows = await db
    .select({ event: schema.event, catalog: schema.eventCatalog })
    .from(schema.event)
    .innerJoin(schema.eventCatalog, eq(schema.event.catalogId, schema.eventCatalog.id))
    .where(eq(schema.event.editionId, edition.id))

  if (eventRows.length === 0) return c.json({ currency, events: [] } )

  const eventIds = eventRows.map(r => r.event.id)

  const confirmedAthletes = await db
    .select()
    .from(schema.athlete)
    .where(
      and(
        eq(schema.athlete.negotiationStatus, 'confirmed'),
        isNull(schema.athlete.archivedAt),
      )
    )

  const athleteIds = confirmedAthletes.map(a => a.id)
  const athleteMap = new Map(confirmedAthletes.map(a => [a.id, a]))

  const appRows = athleteIds.length > 0
    ? await db
      .select()
      .from(schema.application)
      .where(
        and(
          inArray(schema.application.athleteId, athleteIds),
          inArray(schema.application.eventId, eventIds),
        )
      )
    : []

  const appsByEvent = new Map<string, typeof appRows>()
  for (const app of appRows) {
    if (!appsByEvent.has(app.eventId)) appsByEvent.set(app.eventId, [])
    appsByEvent.get(app.eventId)!.push(app)
  }

  const events: ResultEventEntry[] = eventRows.map(({ event, catalog }) => {
    const eventName = `${catalog.name} ${catalog.gender === 'M' ? 'Men' : 'Women'}`

    const prizeFields = [
      event.prizeMoney1st, event.prizeMoney2nd, event.prizeMoney3rd, event.prizeMoney4th,
      event.prizeMoney5th, event.prizeMoney6th, event.prizeMoney7th, event.prizeMoney8th,
    ]
    const prizeSlots = prizeFields
      .map((amount, i) => ({ place: i + 1, amount: amount ?? 0 }))
      .filter(s => s.amount > 0)

    const apps = appsByEvent.get(event.id) ?? []
    const athletes: ResultAthleteEntry[] = apps.map(app => {
      const ath = athleteMap.get(app.athleteId)!
      return {
        applicationId: app.id,
        athleteId: app.athleteId,
        athleteFirstName: ath.firstName,
        athleteLastName: ath.lastName,
        finalPlacement: app.finalPlacement,
        prizeMoney: getPrizeMoney(event, app.finalPlacement),
      }
    }).sort((a, b) => {
      if (a.finalPlacement != null && b.finalPlacement != null) return a.finalPlacement - b.finalPlacement
      if (a.finalPlacement != null) return -1
      if (b.finalPlacement != null) return 1
      return a.athleteLastName.localeCompare(b.athleteLastName)
    })

    return { eventId: event.id, eventName, prizeSlots, athletes }
  })

  events.sort((a, b) => a.eventName.localeCompare(b.eventName))

  return c.json({ currency, events } )
})

export default results
