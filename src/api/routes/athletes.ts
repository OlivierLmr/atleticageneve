import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { and, eq, isNotNull, or, sql } from 'drizzle-orm'
import * as schema from '../db/schema'
import { athleteRegistrationSchema, batchAthleteRegistrationSchema, athleteUpdateSchema, negotiationStatusChangeSchema, interactionSchema } from '@shared/validation'
import { NEGOTIATION_TRANSITIONS, COMMITTEE_EXTRA_TRANSITIONS, ATHLETE_TRANSITIONS } from '@shared/constants'
import { requireAuth } from '../middleware/auth'
import { sendEmail, sendApplicationEmail, buildTransitionEmail, buildManagerAthleteNotificationEmail, buildBatchNotificationEmail } from '../services/email'
import type { EmailContent } from '../services/email'
import { generateToken, magicLinkExpiresAt } from '../services/auth'
import { recalculateAthleteEstimatedCost } from '../services/costEstimation'
import { fetchAndUpsertWaData } from '../services/wa-scraper'
import { upsertWaPerformance } from './wa-performance'
import { isStaff } from '../lib/helpers'
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
    iRunClean: data.iRunClean,
    dopingFree: data.dopingFree,
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
      authorRole: 'athlete',
      createdAt: new Date().toISOString(),
    })
  }

  // Auto-calculate estimated costs
  await recalculateAthleteEstimatedCost(db, athleteId)

  // Auto-fetch WA performance data if profile URL provided
  // waitUntil keeps the Worker alive after the response is sent
  if (data.waProfileUrl) {
    c.executionCtx.waitUntil(
      fetchAndUpsertWaData(db, athleteId, upsertWaPerformance).catch(() => {})
    )
  }

  // If email provided, create a user record so the athlete can log in later
  let magicLinkSent = false
  let emailPreview: EmailContent | null = null
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
    emailPreview = await sendApplicationEmail(db, data.athleteEmail, token, baseUrl, 'en', edition.name)
    magicLinkSent = true
  }

  // If managerId provided, notify the manager
  if (data.managerId) {
    const managers = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, data.managerId))
      .limit(1)

    if (managers.length > 0 && managers[0].email) {
      const managerName = `${managers[0].firstName} ${managers[0].lastName}`
      const notifEmail = buildManagerAthleteNotificationEmail({
        managerName,
        athleteFirstName: data.firstName,
        athleteLastName: data.lastName,
        meetingName: edition.name,
        eventIds: data.eventIds,
      })
      const notifEmailId = await sendEmail({
        db,
        to: managers[0].email,
        subject: notifEmail.subject,
        body: notifEmail.body,
        htmlBody: notifEmail.htmlBody,
        relatedAthleteId: athleteId,
      })
      await db.insert(schema.interaction).values({
        athleteId,
        type: 'manager_notification',
        content: `Manager ${managerName} notified of new registration`,
        authorName: `${data.firstName} ${data.lastName}`,
        authorRole: 'athlete',
        emailLogId: notifEmailId,
        createdAt: new Date().toISOString(),
      })
    }
  }

  return c.json({
    athleteId,
    applicationIds,
    magicLinkSent,
    emailPreview,
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
      dateOfBirth: data.dateOfBirth ?? null,
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
        authorRole: user.role,
        createdAt: new Date().toISOString(),
      })
    }

    await recalculateAthleteEstimatedCost(db, athleteId)

    // Auto-fetch WA performance data if profile URL provided
    // waitUntil keeps the Worker alive after the response is sent
    if (data.waProfileUrl) {
      c.executionCtx.waitUntil(
        fetchAndUpsertWaData(db, athleteId, upsertWaPerformance).catch(() => {})
      )
    }

    results.push({ athleteId, applicationIds, firstName: data.firstName, lastName: data.lastName, eventIds: validEventIds })
  }

  // Email confirmation to manager
  const managerName = `${user.firstName} ${user.lastName}`
  const batchEmail = buildBatchNotificationEmail({
    managerName,
    meetingName: edition.name,
    athletes: results.map(r => ({ firstName: r.firstName, lastName: r.lastName, eventIds: r.eventIds })),
  })
  const batchEmailId = await sendEmail({
    db,
    to: user.email ?? 'manager@unknown',
    subject: batchEmail.subject,
    body: batchEmail.body,
    htmlBody: batchEmail.htmlBody,
  })

  // Create interaction per athlete linking to the batch email
  for (const r of results) {
    await db.insert(schema.interaction).values({
      athleteId: r.athleteId,
      type: 'manager_notification',
      content: `Batch registration confirmation sent to manager ${managerName}`,
      authorName: managerName,
      authorId: user.id,
      authorRole: user.role,
      emailLogId: batchEmailId,
      createdAt: new Date().toISOString(),
    })
  }

  return c.json({ registered: results, emailPreview: batchEmail }, 201)
})

// ── GET /athletes/:id — full athlete profile with applications, agreements, interactions ─

athletes.get('/:id', requireAuth('athlete', 'manager', 'collaborator', 'committee'), async (c) => {
  const db = c.get('db')
  const user = c.get('user')!
  const id = c.req.param('id')!

  const athRows = await db.select().from(schema.athlete).where(eq(schema.athlete.id, id)).limit(1)
  if (athRows.length === 0) {
    return c.json({ error: 'Athlete not found' }, 404)
  }
  const ath = athRows[0]

  // Ownership check for athlete/manager roles
  const staff = isStaff(user.role)
  if (!staff) {
    const isOwner = ath.userId === user.id
    const isManager = ath.managerId === user.id
    if (!isOwner && !isManager) {
      return c.json({ error: 'Not authorized to view this athlete' }, 403)
    }
  }

  // Fetch manager name if managerId exists
  let managerName: string | null = null
  if (ath.managerId) {
    const managerRows = await db.select().from(schema.user).where(eq(schema.user.id, ath.managerId)).limit(1)
    if (managerRows.length > 0) {
      managerName = `${managerRows[0].firstName} ${managerRows[0].lastName}`
    }
  }

  // Fetch all applications for this athlete with event + catalog
  const appRows = await db
    .select({
      application: schema.application,
      event: schema.event,
      catalog: schema.eventCatalog,
    })
    .from(schema.application)
    .innerJoin(schema.event, eq(schema.application.eventId, schema.event.id))
    .innerJoin(schema.eventCatalog, eq(schema.event.catalogId, schema.eventCatalog.id))
    .where(eq(schema.application.athleteId, id))

  // Fetch WA performances for all applications
  const waPerfs = await db
    .select()
    .from(schema.waPerformance)
    .where(eq(schema.waPerformance.athleteId, id))

  const waPerfMap = new Map(waPerfs.map(wp => [wp.eventId, wp]))

  const applications = appRows.map(r => ({
    ...r.application,
    event: { ...r.event, catalog: r.catalog },
    waPerformance: waPerfMap.get(r.application.eventId) ?? null,
  }))

  // Fetch agreements with hotel name and room type
  const rawAgreementRows = await db
    .select({
      agreement: schema.agreement,
      hotelName: schema.hotel.name,
      hotelRoomType: schema.hotelRoom.roomType,
    })
    .from(schema.agreement)
    .leftJoin(schema.hotelRoom, eq(schema.agreement.hotelRoomId, schema.hotelRoom.id))
    .leftJoin(schema.hotel, eq(schema.hotelRoom.hotelId, schema.hotel.id))
    .where(eq(schema.agreement.athleteId, id))
    .orderBy(schema.agreement.version)

  const rawAgreements = rawAgreementRows.map(r => ({
    ...r.agreement,
    hotelName: r.hotelName ?? null,
    hotelRoomType: r.hotelRoomType ?? null,
  }))

  // Strip totalCost from agreements for athlete/manager view
  const agreements = staff
    ? rawAgreements
    : rawAgreements.map(a => ({ ...a, totalCost: undefined }))

  // Fetch interactions (ordered most recent first); athlete/manager only see status changes and emailed entries
  const interactionWhere = staff
    ? eq(schema.interaction.athleteId, id)
    : and(
        eq(schema.interaction.athleteId, id),
        or(
          isNotNull(schema.interaction.emailLogId),
          eq(schema.interaction.type, 'status_change'),
          eq(schema.interaction.type, 'email'),
        ),
      )
  const interactions = await db
    .select()
    .from(schema.interaction)
    .where(interactionWhere)
    .orderBy(sql`${schema.interaction.createdAt} DESC`)

  // Fetch current edition
  const editions = await db.select().from(schema.edition).limit(1)
  const edition = editions[0] ?? null

  return c.json({
    ...ath,
    managerName,
    // Hide cost estimates from athlete/manager
    ...(staff ? {} : { estTravel: undefined, estAccommodation: undefined, estAppearance: undefined, estTotal: undefined }),
    applications,
    agreements,
    interactions,
    edition: edition ? {
      name: edition.name,
      weightPB: edition.weightPB,
      weightSB: edition.weightSB,
      weightRanking: edition.weightRanking,
      weightCost: edition.weightCost,
      bonusEap: edition.bonusEap,
      stadiumMealCost: edition.stadiumMealCost,
      transportAirportHotelCost: edition.transportAirportHotelCost,
      transportHotelStadiumCost: edition.transportHotelStadiumCost,
    } : null,
  })
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
  const staff = isStaff(user.role)
  if (!isOwner && !isManager && !staff) {
    return c.json({ error: 'Not authorized to update this athlete' }, 403)
  }

  const updates: Record<string, unknown> = { ...data, updatedBy: user.id, updatedAt: new Date().toISOString() }

  await db
    .update(schema.athlete)
    .set(updates)
    .where(eq(schema.athlete.id, id))

  // Recalculate estimated costs when relevant fields change
  if ('nationality' in data || 'managerId' in data) {
    await recalculateAthleteEstimatedCost(db, id)
  }

  return c.json({ id, updated: Object.keys(updates) })
})

// ── PATCH /athletes/:id/negotiation-status — change negotiation status ───────

athletes.patch('/:id/negotiation-status', requireAuth('athlete', 'manager', 'collaborator', 'committee'), zValidator('json', negotiationStatusChangeSchema), async (c) => {
  const db = c.get('db')
  const user = c.get('user')!
  const id = c.req.param('id')!
  const newStatus = c.req.valid('json').status as NegotiationStatus

  // Get athlete
  const athRows = await db.select().from(schema.athlete).where(eq(schema.athlete.id, id)).limit(1)
  if (athRows.length === 0) {
    return c.json({ error: 'Athlete not found' }, 404)
  }
  const ath = athRows[0]
  const currentStatus = ath.negotiationStatus as NegotiationStatus

  const staff = isStaff(user.role)

  // Ownership check for athlete/manager
  if (!staff) {
    if (ath.userId !== user.id && ath.managerId !== user.id) {
      return c.json({ error: 'Not authorized to act on this athlete' }, 403)
    }
  }

  // Validate transition based on role
  let allowed: NegotiationStatus[]
  if (staff) {
    const baseAllowed = NEGOTIATION_TRANSITIONS[currentStatus] ?? []
    const extraAllowed = user.role === 'committee' ? (COMMITTEE_EXTRA_TRANSITIONS[currentStatus] ?? []) : []
    allowed = [...baseAllowed, ...extraAllowed]
  } else {
    allowed = ATHLETE_TRANSITIONS[currentStatus] ?? []
  }
  if (!allowed.includes(newStatus)) {
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
      ...(terminalStates.includes(newStatus) ? { decidedAt: now } : { decidedAt: null }),
    })
    .where(eq(schema.athlete.id, id))

  // Send transition email
  const editions = await db.select().from(schema.edition).limit(1)
  const edition = editions[0]
  const meetingName = edition?.name ?? 'Atletica Geneve'
  const organizationName = 'Atletica Geneve'
  const athleteName = `${ath.firstName} ${ath.lastName}`
  const senderName = `${user.firstName} ${user.lastName}`

  // Look up manager once for both recipient name and email
  let recipientName = athleteName
  let managerEmail: string | null = null
  if (ath.managerId) {
    const managerRows = await db.select().from(schema.user).where(eq(schema.user.id, ath.managerId)).limit(1)
    if (managerRows.length > 0) {
      recipientName = `${managerRows[0].firstName} ${managerRows[0].lastName}`
      managerEmail = managerRows[0].email ?? null
    }
  }

  // For athlete/manager counter-offer transition, look up the most recent counter-offer text
  let counterOfferText: string | undefined
  if (currentStatus === 'agreement_sent' && newStatus === 'counter_offer_sent') {
    const counterOfferRows = await db
      .select()
      .from(schema.interaction)
      .where(and(eq(schema.interaction.athleteId, id), eq(schema.interaction.type, 'counter_offer')))
      .orderBy(sql`${schema.interaction.createdAt} DESC`)
      .limit(1)
    if (counterOfferRows.length > 0) {
      counterOfferText = counterOfferRows[0].content
    }
  }

  // Staff-initiated → email goes to athlete/manager: use their name
  // Athlete/manager-initiated → email goes to organisation: use committee name
  const emailRecipientName = staff ? recipientName : `${meetingName} Organisation Committee`

  const transitionEmail = buildTransitionEmail({
    from: currentStatus,
    to: newStatus,
    athleteName,
    meetingName,
    senderName,
    recipientName: emailRecipientName,
    organizationName,
    counterOfferText,
  })

  let emailLogId: string | null = null

  // Staff-initiated transitions: email goes to athlete/manager
  if (staff && transitionEmail) {
    const emailTo = ath.athleteEmail ?? managerEmail
    if (emailTo) {
      emailLogId = await sendEmail({
        db,
        to: emailTo,
        subject: transitionEmail.subject,
        body: transitionEmail.body,
        htmlBody: transitionEmail.htmlBody,
        relatedAthleteId: id,
      })
    }
  }

  // Athlete/manager-initiated transitions: notify edition notification email
  if (!staff && edition?.notificationEmail && transitionEmail) {
    emailLogId = await sendEmail({
      db,
      to: edition.notificationEmail,
      subject: transitionEmail.subject,
      body: transitionEmail.body,
      htmlBody: transitionEmail.htmlBody,
      relatedAthleteId: id,
    })
  }

  // Log interaction with email reference
  await db.insert(schema.interaction).values({
    athleteId: id,
    type: 'status_change',
    content: `Negotiation status changed from "${currentStatus}" to "${newStatus}"`,
    authorId: user.id,
    authorName: senderName,
    authorRole: user.role,
    emailLogId,
    createdAt: new Date().toISOString(),
  })

  return c.json({
    id,
    status: newStatus,
    previousStatus: currentStatus,
    emailPreview: transitionEmail ?? undefined,
  })
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

// ── POST /athletes/:id/interactions — add interaction at athlete level ────────

athletes.post('/:id/interactions', requireAuth('athlete', 'manager', 'collaborator', 'committee'), zValidator('json', interactionSchema), async (c) => {
  const db = c.get('db')
  const user = c.get('user')!
  const id = c.req.param('id')!
  const { type, content, applicationId } = c.req.valid('json')

  // Verify athlete exists
  const athRows = await db.select().from(schema.athlete).where(eq(schema.athlete.id, id)).limit(1)
  if (athRows.length === 0) {
    return c.json({ error: 'Athlete not found' }, 404)
  }
  const ath = athRows[0]

  // Ownership check for athlete/manager
  const staff = isStaff(user.role)
  if (!staff) {
    if (ath.userId !== user.id && ath.managerId !== user.id) {
      return c.json({ error: 'Not authorized' }, 403)
    }
  }

  // If applicationId provided, verify it belongs to this athlete
  if (applicationId) {
    const appRows = await db
      .select()
      .from(schema.application)
      .where(eq(schema.application.id, applicationId))
      .limit(1)
    if (appRows.length === 0 || appRows[0].athleteId !== id) {
      return c.json({ error: 'Application not found or does not belong to this athlete' }, 400)
    }
  }

  const interactionId = crypto.randomUUID()
  await db.insert(schema.interaction).values({
    id: interactionId,
    athleteId: id,
    applicationId,
    type,
    content,
    authorId: user.id,
    authorName: `${user.firstName} ${user.lastName}`,
    authorRole: user.role,
    createdAt: new Date().toISOString(),
  })

  return c.json({ id: interactionId }, 201)
})

export default athletes
