import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema'
import { athleteRegistrationSchema, batchAthleteRegistrationSchema, athleteUpdateSchema, negotiationStatusChangeSchema } from '@shared/validation'
import { NEGOTIATION_TRANSITIONS } from '@shared/constants'
import { requireAuth } from '../middleware/auth'
import { sendEmail, sendMagicLinkEmail } from '../services/email'
import { generateToken, magicLinkExpiresAt } from '../services/auth'
import type { Env } from '../index'
import type { NegotiationStatus } from '@shared/types'

const athletes = new Hono<Env>()

// ── POST /athletes — self-registration (public, no auth) ─────────────────────

athletes.post('/', zValidator('json', athleteRegistrationSchema), async (c) => {
  const data = c.req.valid('json')
  const db = c.get('db')

  // Get current edition
  const editions = await db.select().from(schema.edition).limit(1)
  if (editions.length === 0) {
    return c.json({ error: 'No edition configured' }, 400)
  }
  const edition = editions[0]

  // Verify all events exist
  const allEvents = await db.select().from(schema.event)
  const eventMap = new Map(allEvents.map(e => [e.id, e]))
  for (const eventId of data.eventIds) {
    if (!eventMap.has(eventId)) {
      return c.json({ error: `Event not found: ${eventId}` }, 400)
    }
  }

  // Create athlete record
  const athleteId = crypto.randomUUID()
  await db.insert(schema.athlete).values({
    id: athleteId,
    managerId: data.managerId ?? null,
    editionId: edition.id,
    firstName: data.firstName,
    lastName: data.lastName,
    dateOfBirth: data.dateOfBirth ?? null,
    nationality: data.nationality,
    gender: data.gender,
    federation: data.federation ?? null,
    isEap: data.isEap,
    isSwiss: data.isSwiss,
    distanceFromGva: data.distanceFromGva ?? 0,
    waProfileUrl: data.waProfileUrl ?? null,
    swiLicence: data.swiLicence ?? null,
    athleteEmail: data.athleteEmail,
    athletePhone: data.athletePhone ?? null,
    eapCity: data.eapCity ?? null,
    iRunClean: data.iRunClean ? 'yes' : 'unknown',
    dopingFree: data.dopingFree ? 'yes' : 'unknown',
    participantNotes: data.participantNotes ?? null,
    additionalNotes: data.additionalNotes ?? null,
    negotiationStatus: 'to_review',
  })

  // Create one application per event
  const applicationIds: string[] = []
  for (const eventId of data.eventIds) {
    const applicationId = crypto.randomUUID()
    applicationIds.push(applicationId)

    await db.insert(schema.application).values({
      id: applicationId,
      athleteId,
      eventId,
      editionId: edition.id,
      participationStatus: 'pending',
    })

    // Log interaction
    await db.insert(schema.interaction).values({
      athleteId,
      applicationId,
      type: 'status_change',
      content: 'Application submitted',
      authorName: `${data.firstName} ${data.lastName}`,
    })
  }

  // If email provided, create a user record so the athlete can log in later
  let magicLinkSent = false
  if (data.athleteEmail) {
    const existingUsers = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, data.athleteEmail))
      .limit(1)

    let userId: string
    if (existingUsers.length > 0) {
      userId = existingUsers[0].id
    } else {
      userId = crypto.randomUUID()
      await db.insert(schema.user).values({
        id: userId,
        role: 'athlete',
        email: data.athleteEmail,
        phone: data.athletePhone ?? null,
        firstName: data.firstName,
        lastName: data.lastName,
      })
    }

    // Link athlete to user
    await db
      .update(schema.athlete)
      .set({ userId })
      .where(eq(schema.athlete.id, athleteId))

    // Generate and send magic link
    const token = generateToken()
    await db.insert(schema.magicLink).values({
      userId,
      token,
      expiresAt: magicLinkExpiresAt(),
    })

    const baseUrl = c.req.header('Origin') ?? 'http://localhost:5173'
    await sendMagicLinkEmail(db, data.athleteEmail, token, baseUrl)
    magicLinkSent = true
  }

  return c.json({
    athleteId,
    applicationIds,
    magicLinkSent,
  }, 201)
})

// ── POST /athletes/batch — register multiple athletes (manager) ──────────────

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

  // Preload events
  const allEvents = await db.select().from(schema.event)
  const eventMap = new Map(allEvents.map(e => [e.id, e]))

  const results: Array<{ athleteId: string; applicationIds: string[]; firstName: string; lastName: string; eventIds: string[] }> = []

  for (const data of athleteList) {
    // Verify all events exist
    const validEventIds = data.eventIds.filter(id => eventMap.has(id))
    if (validEventIds.length === 0) continue

    const athleteId = crypto.randomUUID()
    await db.insert(schema.athlete).values({
      id: athleteId,
      managerId: user.id,
      editionId: edition.id,
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth,
      nationality: data.nationality,
      gender: data.gender,
      isEap: data.isEap,
      waProfileUrl: data.waProfileUrl ?? null,
      negotiationStatus: 'to_review',
    })

    // Create one application per event
    const applicationIds: string[] = []
    for (const eventId of validEventIds) {
      const applicationId = crypto.randomUUID()
      applicationIds.push(applicationId)

      await db.insert(schema.application).values({
        id: applicationId,
        athleteId,
        eventId,
        editionId: edition.id,
        participationStatus: 'pending',
      })

      await db.insert(schema.interaction).values({
        athleteId,
        applicationId,
        type: 'status_change',
        content: `Application submitted by manager ${user.firstName} ${user.lastName}`,
        authorId: user.id,
        authorName: `${user.firstName} ${user.lastName}`,
      })
    }

    results.push({ athleteId, applicationIds, firstName: data.firstName, lastName: data.lastName, eventIds: validEventIds })
  }

  // Email stub to manager
  await sendEmail({
    db,
    to: user.email ?? 'manager@unknown',
    subject: `Batch registration complete — ${results.length} athletes`,
    body: `You have registered ${results.length} athletes:\n${results.map(r => `- ${r.firstName} ${r.lastName} (${r.eventIds.join(', ')})`).join('\n')}`,
  })

  return c.json({ registered: results }, 201)
})

// ── GET /athletes/:id — get athlete profile ──────────────────────────────────

athletes.get('/:id', requireAuth('collaborator', 'committee'), async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')!

  const results = await db.select().from(schema.athlete).where(eq(schema.athlete.id, id)).limit(1)
  if (results.length === 0) {
    return c.json({ error: 'Athlete not found' }, 404)
  }

  return c.json(results[0])
})

// ── PATCH /athletes/:id — update athlete data ────────────────────────────────

athletes.patch('/:id', requireAuth('athlete', 'manager', 'collaborator', 'committee'), zValidator('json', athleteUpdateSchema), async (c) => {
  const db = c.get('db')
  const user = c.get('user')!
  const id = c.req.param('id')!
  const data = c.req.valid('json')

  // Verify athlete exists
  const athRows = await db.select().from(schema.athlete).where(eq(schema.athlete.id, id)).limit(1)
  if (athRows.length === 0) {
    return c.json({ error: 'Athlete not found' }, 404)
  }
  const ath = athRows[0]

  // Access control: owner, their manager, or collaborator/committee
  const isOwner = ath.userId === user.id
  const isManager = ath.managerId === user.id
  const isStaff = ['collaborator', 'committee'].includes(user.role)
  if (!isOwner && !isManager && !isStaff) {
    return c.json({ error: 'Not authorized to update this athlete' }, 403)
  }

  // Auto-recompute estTotal if cost fields change
  const updates: Record<string, unknown> = { ...data, updatedBy: user.id, updatedAt: new Date().toISOString() }
  if ('estTravel' in data || 'estAccommodation' in data || 'estAppearance' in data) {
    const travel = (data.estTravel ?? ath.estTravel) || 0
    const accommodation = (data.estAccommodation ?? ath.estAccommodation) || 0
    const appearance = (data.estAppearance ?? ath.estAppearance) || 0
    updates.estTotal = travel + accommodation + appearance
  }

  await db
    .update(schema.athlete)
    .set(updates)
    .where(eq(schema.athlete.id, id))

  return c.json({ id, updated: Object.keys(updates) })
})

// ── PATCH /athletes/:id/negotiation-status — change negotiation status ───────

athletes.patch('/:id/negotiation-status', requireAuth('collaborator', 'committee'), async (c) => {
  const db = c.get('db')
  const user = c.get('user')!
  const id = c.req.param('id')!

  const body = await c.req.json()
  const parsed = negotiationStatusChangeSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid status', details: parsed.error.flatten() }, 400)
  }
  const newStatus = parsed.data.status as NegotiationStatus

  // Get athlete
  const athRows = await db.select().from(schema.athlete).where(eq(schema.athlete.id, id)).limit(1)
  if (athRows.length === 0) {
    return c.json({ error: 'Athlete not found' }, 404)
  }
  const ath = athRows[0]
  const currentStatus = ath.negotiationStatus as NegotiationStatus

  // Validate transition
  const allowed = NEGOTIATION_TRANSITIONS[currentStatus]
  if (!allowed || !allowed.includes(newStatus)) {
    return c.json({
      error: `Cannot transition from "${currentStatus}" to "${newStatus}"`,
      allowedTransitions: allowed,
    }, 400)
  }

  // Update athlete negotiation status
  const now = new Date().toISOString()
  const terminalStates: NegotiationStatus[] = ['confirmed', 'rejected', 'withdrawn']
  await db
    .update(schema.athlete)
    .set({
      negotiationStatus: newStatus,
      updatedAt: now,
      ...(terminalStates.includes(newStatus) ? { decidedAt: now } : {}),
    })
    .where(eq(schema.athlete.id, id))

  // Log interaction
  await db.insert(schema.interaction).values({
    athleteId: id,
    type: 'status_change',
    content: `Negotiation status changed from "${currentStatus}" to "${newStatus}"`,
    authorId: user.id,
    authorName: `${user.firstName} ${user.lastName}`,
  })

  return c.json({ id, status: newStatus, previousStatus: currentStatus })
})

// ── DELETE /athletes/:id — archive (committee only) ──────────────────────────

athletes.delete('/:id', requireAuth('committee'), async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')!

  const athRows = await db.select().from(schema.athlete).where(eq(schema.athlete.id, id)).limit(1)
  if (athRows.length === 0) {
    return c.json({ error: 'Athlete not found' }, 404)
  }

  await db
    .update(schema.athlete)
    .set({ archivedAt: new Date().toISOString() })
    .where(eq(schema.athlete.id, id))

  return c.json({ id, archived: true })
})

// ── POST /athletes/:id/restore — restore (committee only) ────────────────────

athletes.post('/:id/restore', requireAuth('committee'), async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')!

  const athRows = await db.select().from(schema.athlete).where(eq(schema.athlete.id, id)).limit(1)
  if (athRows.length === 0) {
    return c.json({ error: 'Athlete not found' }, 404)
  }

  await db
    .update(schema.athlete)
    .set({ archivedAt: null })
    .where(eq(schema.athlete.id, id))

  return c.json({ id, archived: false })
})

export default athletes
