import { Hono } from 'hono'
import { eq, and, isNull, desc, inArray } from 'drizzle-orm'
import * as schema from '../db/schema'
import { requireAuth } from '../middleware/auth'
import { sendEmail, buildPaymentProformaEmail } from '../services/email'
import { generateToken, magicLinkExpiresAt } from '../services/auth'
import type { Env } from '../index'
import type { PaymentEntry, PaymentEventLine } from '@shared/types'

const payments = new Hono<Env>()

payments.use('*', requireAuth('committee'))

// ── Helper: compute prize money for a given placement ────────────────────────

function getPrizeMoney(event: typeof schema.event.$inferSelect, placement: number | null): number {
  if (!placement || placement < 1 || placement > 8) return 0
  const fields: (keyof typeof event)[] = [
    'prizeMoney1st', 'prizeMoney2nd', 'prizeMoney3rd', 'prizeMoney4th',
    'prizeMoney5th', 'prizeMoney6th', 'prizeMoney7th', 'prizeMoney8th',
  ]
  const field = fields[placement - 1]
  return field ? (event[field] as number) ?? 0 : 0
}

// ── GET /payments — list all confirmed athletes with payment breakdown ─────────

payments.get('/', async (c) => {
  const db = c.get('db')

  const editions = await db.select().from(schema.edition).limit(1)
  const edition = editions[0]
  const currency = edition?.currency ?? 'CHF'

  const confirmedAthletes = await db
    .select()
    .from(schema.athlete)
    .where(
      and(
        eq(schema.athlete.negotiationStatus, 'confirmed'),
        isNull(schema.athlete.archivedAt),
      )
    )

  if (confirmedAthletes.length === 0) return c.json([])

  const athleteIds = confirmedAthletes.map(a => a.id)

  const appRows = await db
    .select({
      application: schema.application,
      event: schema.event,
      catalog: schema.eventCatalog,
    })
    .from(schema.application)
    .innerJoin(schema.event, eq(schema.application.eventId, schema.event.id))
    .innerJoin(schema.eventCatalog, eq(schema.event.catalogId, schema.eventCatalog.id))
    .where(inArray(schema.application.athleteId, athleteIds))

  const appsByAthlete = new Map<string, typeof appRows>()
  for (const row of appRows) {
    const key = row.application.athleteId
    if (!appsByAthlete.has(key)) appsByAthlete.set(key, [])
    appsByAthlete.get(key)!.push(row)
  }

  const allAgreements = await db
    .select()
    .from(schema.agreement)
    .where(inArray(schema.agreement.athleteId, athleteIds))

  const latestAgreementMap = new Map<string, typeof allAgreements[number]>()
  for (const agr of allAgreements) {
    const existing = latestAgreementMap.get(agr.athleteId)
    if (!existing || agr.version > existing.version) {
      latestAgreementMap.set(agr.athleteId, agr)
    }
  }

  const managerIds = [...new Set(confirmedAthletes.map(a => a.managerId).filter((id): id is string => !!id))]
  const managers = managerIds.length > 0
    ? await db.select().from(schema.user).where(inArray(schema.user.id, managerIds))
    : []
  const managerMap = new Map(managers.map(m => [m.id, m]))

  const entries: PaymentEntry[] = confirmedAthletes.map(ath => {
    const agreement = latestAgreementMap.get(ath.id)
    const appearanceFee = agreement?.appearanceFee ?? 0
    const otherCompensation = agreement?.otherCompensation ?? 0
    const otherCompensationDesc = agreement?.otherCompensationDesc ?? null

    const apps = appsByAthlete.get(ath.id) ?? []
    const events: PaymentEventLine[] = apps.map(row => ({
      applicationId: row.application.id,
      eventName: `${row.catalog.name} ${row.catalog.gender === 'M' ? 'Men' : 'Women'}`,
      finalPlacement: row.application.finalPlacement,
      prizeMoney: getPrizeMoney(row.event, row.application.finalPlacement),
    }))

    const totalPrizeMoney = events.reduce((sum, e) => sum + e.prizeMoney, 0)
    const totalDue = appearanceFee + otherCompensation + totalPrizeMoney

    const manager = ath.managerId ? managerMap.get(ath.managerId) : null
    const recipientName = manager
      ? `${manager.firstName} ${manager.lastName}`
      : `${ath.firstName} ${ath.lastName}`
    const recipientEmail = manager ? manager.email : ath.athleteEmail
    const recipientIban = manager ? manager.bankIban : ath.bankIban

    return {
      athleteId: ath.id,
      athleteFirstName: ath.firstName,
      athleteLastName: ath.lastName,
      managerId: ath.managerId,
      managerName: manager ? `${manager.firstName} ${manager.lastName}` : null,
      recipientName,
      recipientEmail,
      recipientIban,
      appearanceFee,
      otherCompensation,
      otherCompensationDesc,
      events,
      totalPrizeMoney,
      totalDue,
      paymentStatus: ath.paymentStatus as 'pending' | 'done',
      paymentDate: ath.paymentDate,
      currency,
    }
  })

  return c.json(entries)
})

// ── POST /payments/:athleteId/send-email — send proforma to recipient ─────────

payments.post('/:athleteId/send-email', async (c) => {
  const db = c.get('db')
  const athleteId = c.req.param('athleteId')
  const user = c.get('user')!

  const athRows = await db.select().from(schema.athlete).where(eq(schema.athlete.id, athleteId)).limit(1)
  if (athRows.length === 0) return c.json({ error: 'Athlete not found' }, 404)
  const ath = athRows[0]

  if (ath.negotiationStatus !== 'confirmed') {
    return c.json({ error: 'Athlete is not confirmed' }, 400)
  }

  const editions = await db.select().from(schema.edition).limit(1)
  const edition = editions[0]
  const currency = edition?.currency ?? 'CHF'
  const meetingName = edition?.name ?? 'Atletica Genève'

  const agreements = await db
    .select()
    .from(schema.agreement)
    .where(eq(schema.agreement.athleteId, athleteId))
    .orderBy(desc(schema.agreement.version))
    .limit(1)
  const agreement = agreements[0] ?? null

  const appRows = await db
    .select({
      application: schema.application,
      event: schema.event,
      catalog: schema.eventCatalog,
    })
    .from(schema.application)
    .innerJoin(schema.event, eq(schema.application.eventId, schema.event.id))
    .innerJoin(schema.eventCatalog, eq(schema.event.catalogId, schema.eventCatalog.id))
    .where(eq(schema.application.athleteId, athleteId))

  const events = appRows.map(row => ({
    eventName: `${row.catalog.name} ${row.catalog.gender === 'M' ? 'Men' : 'Women'}`,
    finalPlacement: row.application.finalPlacement,
    prizeMoney: getPrizeMoney(row.event, row.application.finalPlacement),
  }))

  const appearanceFee = agreement?.appearanceFee ?? 0
  const otherCompensation = agreement?.otherCompensation ?? 0
  const otherCompensationDesc = agreement?.otherCompensationDesc ?? null
  const totalPrizeMoney = events.reduce((sum, e) => sum + e.prizeMoney, 0)
  const totalDue = appearanceFee + otherCompensation + totalPrizeMoney

  let recipientName: string
  let recipientEmail: string | null
  let recipientIban: string | null
  let portalUserId: string | null = null
  let portalRedirect = '/athlete/portal'

  if (ath.managerId) {
    const managerRows = await db.select().from(schema.user).where(eq(schema.user.id, ath.managerId)).limit(1)
    const manager = managerRows[0]
    recipientName = manager ? `${manager.firstName} ${manager.lastName}` : `${ath.firstName} ${ath.lastName}`
    recipientEmail = manager?.email ?? null
    recipientIban = manager?.bankIban ?? null
    portalUserId = ath.managerId
    portalRedirect = '/manager/portal'
  } else {
    recipientName = `${ath.firstName} ${ath.lastName}`
    recipientEmail = ath.athleteEmail
    recipientIban = ath.bankIban
    portalUserId = ath.userId
    portalRedirect = '/athlete/portal'
  }

  if (!recipientEmail) {
    return c.json({ error: 'No email address for recipient' }, 400)
  }

  const baseUrl = c.req.header('Origin') ?? 'https://atleticageneve.pages.dev'
  let portalLink = baseUrl + portalRedirect

  if (!recipientIban && portalUserId) {
    const token = generateToken()
    await db.insert(schema.magicLink).values({
      userId: portalUserId,
      token,
      expiresAt: magicLinkExpiresAt(60 * 24 * 30),
      redirectUrl: portalRedirect,
    })
    portalLink = `${baseUrl}/auth/verify?token=${token}`
  }

  const emailContent = buildPaymentProformaEmail({
    recipientName,
    athleteFirstName: ath.firstName,
    athleteLastName: ath.lastName,
    meetingName,
    currency,
    appearanceFee,
    otherCompensation,
    otherCompensationDesc,
    events,
    totalDue,
    recipientIban,
    portalLink,
  })

  const emailLogId = await sendEmail({
    db,
    to: recipientEmail,
    subject: emailContent.subject,
    body: emailContent.body,
    htmlBody: emailContent.htmlBody,
    relatedAthleteId: athleteId,
  })

  await db.insert(schema.interaction).values({
    athleteId,
    type: 'email',
    content: `Payment proforma sent to ${recipientName} (${recipientEmail}) — total: ${currency} ${totalDue.toLocaleString()}`,
    authorId: user.id,
    authorName: `${user.firstName} ${user.lastName}`,
    authorRole: user.role,
    emailLogId,
    createdAt: new Date().toISOString(),
  })

  return c.json({ emailLogId, emailPreview: emailContent })
})

export default payments
