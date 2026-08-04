import { Hono } from 'hono'
import { eq, and, isNull, inArray } from 'drizzle-orm'
import * as schema from '../db/schema'
import { requireAuth } from '../middleware/auth'
import { sendEmail, buildLogisticsReminderEmail } from '../services/email'
import { generateToken, magicLinkExpiresAt } from '../services/auth'
import type { Env } from '../index'
import type { LogisticsEntry } from '@shared/types'

const logistics = new Hono<Env>()

logistics.use('*', requireAuth('committee'))

// ── Helper: is an athlete's travel logistics complete? ───────────────────────
// The requirement depends on the travel mode: plane needs the full itinerary
// (dates, times, origin/destination, flight numbers), train only needs the
// arrival/departure dates, and road has no required fields at all. No mode
// selected at all means the athlete hasn't touched the form yet.

function isLogisticsComplete(ath: typeof schema.athlete.$inferSelect): boolean {
  switch (ath.travelMode) {
    case 'plane':
      return !!(
        ath.arrivalDate && ath.arrivalTime && ath.arrivalFrom && ath.arrivalFlight &&
        ath.departureDate && ath.departureTime && ath.departureTo && ath.departureFlight
      )
    case 'train':
      return !!(ath.arrivalDate && ath.departureDate)
    case 'road':
      return true
    default:
      return false
  }
}

// ── GET /logistics — list confirmed athletes with travel logistics status ────

logistics.get('/', async (c) => {
  const db = c.get('db')

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

  const managerIds = [...new Set(confirmedAthletes.map(a => a.managerId).filter((id): id is string => !!id))]
  const managers = managerIds.length > 0
    ? await db.select().from(schema.user).where(inArray(schema.user.id, managerIds))
    : []
  const managerMap = new Map(managers.map(m => [m.id, m]))

  const entries: LogisticsEntry[] = confirmedAthletes.map(ath => {
    const manager = ath.managerId ? managerMap.get(ath.managerId) : null
    const recipientName = manager
      ? `${manager.firstName} ${manager.lastName}`
      : `${ath.firstName} ${ath.lastName}`
    const recipientEmail = manager ? manager.email : ath.athleteEmail

    return {
      athleteId: ath.id,
      athleteFirstName: ath.firstName,
      athleteLastName: ath.lastName,
      managerId: ath.managerId,
      managerName: manager ? `${manager.firstName} ${manager.lastName}` : null,
      recipientName,
      recipientEmail,
      travelMode: ath.travelMode as LogisticsEntry['travelMode'],
      arrivalDate: ath.arrivalDate,
      arrivalTime: ath.arrivalTime,
      arrivalFrom: ath.arrivalFrom,
      arrivalFlight: ath.arrivalFlight,
      departureDate: ath.departureDate,
      departureTime: ath.departureTime,
      departureTo: ath.departureTo,
      departureFlight: ath.departureFlight,
      accommodationReqs: ath.accommodationReqs,
      logisticsComplete: isLogisticsComplete(ath),
    }
  })

  return c.json(entries)
})

// ── POST /logistics/:athleteId/send-email — send a reminder to the recipient ─

logistics.post('/:athleteId/send-email', async (c) => {
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
  const meetingName = editions[0]?.name ?? 'Atletica Genève'

  let recipientName: string
  let recipientEmail: string | null
  let recipientLang: 'en' | 'fr' = 'en'
  let portalUserId: string | null
  let portalRedirect: string

  if (ath.managerId) {
    const managerRows = await db.select().from(schema.user).where(eq(schema.user.id, ath.managerId)).limit(1)
    const manager = managerRows[0]
    recipientName = manager ? `${manager.firstName} ${manager.lastName}` : `${ath.firstName} ${ath.lastName}`
    recipientEmail = manager?.email ?? null
    recipientLang = (manager?.preferredLang as 'en' | 'fr') ?? 'en'
    portalUserId = ath.managerId
    portalRedirect = `/manager/athletes/${athleteId}?tab=logistics`
  } else {
    recipientName = `${ath.firstName} ${ath.lastName}`
    recipientEmail = ath.athleteEmail
    portalUserId = ath.userId
    portalRedirect = `/athlete/athletes/${athleteId}?tab=logistics`
    if (ath.userId) {
      const userRows = await db.select().from(schema.user).where(eq(schema.user.id, ath.userId)).limit(1)
      recipientLang = (userRows[0]?.preferredLang as 'en' | 'fr') ?? 'en'
    }
  }

  if (!recipientEmail) {
    return c.json({ error: 'No email address for recipient' }, 400)
  }

  const baseUrl = c.req.header('Origin') ?? 'https://atleticageneve.pages.dev'
  let portalLink = baseUrl + portalRedirect

  if (portalUserId) {
    const token = generateToken()
    await db.insert(schema.magicLink).values({
      userId: portalUserId,
      token,
      expiresAt: magicLinkExpiresAt(60 * 24 * 30),
      redirectUrl: portalRedirect,
    })
    portalLink = `${baseUrl}/auth/verify?token=${token}`
  }

  const emailContent = buildLogisticsReminderEmail({
    recipientName,
    athleteFirstName: ath.firstName,
    athleteLastName: ath.lastName,
    meetingName,
    lang: recipientLang,
    portalLink,
  })

  const emailLogId = await sendEmail({
    db,
    to: recipientEmail,
    subject: emailContent.subject,
    body: emailContent.body,
    htmlBody: emailContent.htmlBody,
    lang: recipientLang,
    relatedAthleteId: athleteId,
  })

  await db.insert(schema.interaction).values({
    athleteId,
    type: 'email',
    content: `Travel logistics reminder sent to ${recipientName} (${recipientEmail})`,
    authorId: user.id,
    authorName: `${user.firstName} ${user.lastName}`,
    authorRole: user.role,
    emailLogId,
    createdAt: new Date().toISOString(),
  })

  return c.json({ emailLogId, emailPreview: emailContent })
})

export default logistics
