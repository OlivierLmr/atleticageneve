import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema'
import { athleteRegistrationSchema, batchAthleteRegistrationSchema } from '@shared/validation'
import { parsePerf, computeScore } from '@shared/scoring'
import { requireAuth } from '../middleware/auth'
import { sendEmail } from '../services/email'
import type { Env } from '../index'

const athletes = new Hono<Env>()

// ── POST /athletes — register a single athlete + create application ───────────

athletes.post('/', zValidator('json', athleteRegistrationSchema), async (c) => {
  const data = c.req.valid('json')
  const db = c.get('db')

  // Get current edition
  const editions = await db.select().from(schema.edition).limit(1)
  if (editions.length === 0) {
    return c.json({ error: 'No edition configured' }, 400)
  }
  const edition = editions[0]

  // Verify event exists
  const events = await db.select().from(schema.event).where(eq(schema.event.id, data.eventId)).limit(1)
  if (events.length === 0) {
    return c.json({ error: 'Event not found' }, 400)
  }

  // Create athlete record
  const athleteId = crypto.randomUUID()
  await db.insert(schema.athlete).values({
    id: athleteId,
    managerId: data.managerId ?? null,
    firstName: data.firstName,
    lastName: data.lastName,
    dateOfBirth: data.dateOfBirth ?? null,
    nationality: data.nationality,
    gender: data.gender,
    federation: data.federation ?? null,
    isEap: data.isEap,
    isSwiss: data.isSwiss,
    distanceFromGva: data.distanceFromGva,
    waProfileUrl: data.waProfileUrl ?? null,
    swiLicence: data.swiLicence ?? null,
    athleteEmail: data.athleteEmail ?? null,
    athletePhone: data.athletePhone ?? null,
  })

  // Parse performance values
  const pbVal = parsePerf(data.personalBest)
  const sbVal = parsePerf(data.seasonBest)

  // Compute score
  const evt = events[0]
  const scoreResult = computeScore({
    eventId: data.eventId,
    personalBest: data.personalBest,
    seasonBest: data.seasonBest,
    swissMinima: String(evt.swissMinima),
    worldRanking: data.worldRanking ?? 100,
    estimatedCostTotal: 0, // will be estimated later
    isEap: data.isEap,
  })

  // Create application
  const applicationId = crypto.randomUUID()
  await db.insert(schema.application).values({
    id: applicationId,
    athleteId,
    eventId: data.eventId,
    editionId: edition.id,
    status: 'to_review',
    personalBest: data.personalBest,
    personalBestVal: pbVal,
    seasonBest: data.seasonBest,
    seasonBestVal: sbVal,
    worldRanking: data.worldRanking ?? null,
    perfUpdatedAt: new Date().toISOString(),
    score: scoreResult.finalScore,
    recommendation: scoreResult.recommendation,
    iRunClean: data.iRunClean,
    dopingFree: data.dopingFree,
    participantNotes: data.participantNotes ?? null,
    additionalNotes: data.additionalNotes ?? null,
  })

  // Log interaction
  await db.insert(schema.interaction).values({
    applicationId,
    type: 'status_change',
    content: 'Application submitted',
    authorName: `${data.firstName} ${data.lastName}`,
  })

  // Email stub
  if (data.athleteEmail) {
    sendEmail({
      to: data.athleteEmail,
      subject: `Application received — ${data.firstName} ${data.lastName}`,
      body: `Your application for ${events[0].name} has been received.\nWe will review it shortly.`,
    })
  }

  return c.json({
    athleteId,
    applicationId,
    score: scoreResult.finalScore,
    recommendation: scoreResult.recommendation,
  }, 201)
})

// ── POST /athletes/batch — register multiple athletes (manager) ───────────────

athletes.post('/batch', requireAuth('manager'), zValidator('json', batchAthleteRegistrationSchema), async (c) => {
  const { athletes: athleteList } = c.req.valid('json')
  const db = c.get('db')
  const user = c.get('user')!

  // Get current edition
  const editions = await db.select().from(schema.edition).limit(1)
  if (editions.length === 0) {
    return c.json({ error: 'No edition configured' }, 400)
  }
  const edition = editions[0]

  const results: Array<{ athleteId: string; applicationId: string; firstName: string; lastName: string; eventId: string }> = []

  for (const data of athleteList) {
    // Verify event exists
    const events = await db.select().from(schema.event).where(eq(schema.event.id, data.eventId)).limit(1)
    if (events.length === 0) continue

    const athleteId = crypto.randomUUID()
    await db.insert(schema.athlete).values({
      id: athleteId,
      managerId: user.id,
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth ?? null,
      nationality: data.nationality,
      gender: data.gender,
      federation: data.federation ?? null,
      isEap: data.isEap,
      isSwiss: data.isSwiss,
      distanceFromGva: data.distanceFromGva,
      waProfileUrl: data.waProfileUrl ?? null,
      swiLicence: data.swiLicence ?? null,
      athleteEmail: data.athleteEmail ?? null,
      athletePhone: data.athletePhone ?? null,
    })

    const pbVal = parsePerf(data.personalBest)
    const sbVal = parsePerf(data.seasonBest)

    const applicationId = crypto.randomUUID()
    await db.insert(schema.application).values({
      id: applicationId,
      athleteId,
      eventId: data.eventId,
      editionId: edition.id,
      status: 'to_review',
      personalBest: data.personalBest,
      personalBestVal: pbVal,
      seasonBest: data.seasonBest,
      seasonBestVal: sbVal,
      worldRanking: data.worldRanking ?? null,
      perfUpdatedAt: new Date().toISOString(),
      iRunClean: data.iRunClean,
      dopingFree: data.dopingFree,
      participantNotes: data.participantNotes ?? null,
      additionalNotes: data.additionalNotes ?? null,
    })

    await db.insert(schema.interaction).values({
      applicationId,
      type: 'status_change',
      content: `Application submitted by manager ${user.firstName} ${user.lastName}`,
      authorId: user.id,
      authorName: `${user.firstName} ${user.lastName}`,
    })

    results.push({ athleteId, applicationId, firstName: data.firstName, lastName: data.lastName, eventId: data.eventId })
  }

  // Email stub to manager
  sendEmail({
    to: user.email ?? 'manager@unknown',
    subject: `Batch registration complete — ${results.length} athletes`,
    body: `You have registered ${results.length} athletes:\n${results.map(r => `- ${r.firstName} ${r.lastName} (${r.eventId})`).join('\n')}`,
  })

  return c.json({ registered: results }, 201)
})

// ── GET /athletes/:id — get athlete profile ───────────────────────────────────

athletes.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')

  const results = await db.select().from(schema.athlete).where(eq(schema.athlete.id, id)).limit(1)
  if (results.length === 0) {
    return c.json({ error: 'Athlete not found' }, 404)
  }

  return c.json(results[0])
})

export default athletes
