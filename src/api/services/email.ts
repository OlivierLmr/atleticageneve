/**
 * Email service stub — logs to console and persists to email_log table.
 * Replace with a real provider (Resend, SendGrid, etc.) for production.
 */

import type { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema'

type DB = DrizzleD1Database<typeof schema>

interface EmailParams {
  db: DB
  to: string
  subject: string
  body: string
  htmlBody?: string
  lang?: 'en' | 'fr'
  relatedAthleteId?: string
}

export async function sendEmail({ db, to, subject, body, htmlBody, lang = 'en', relatedAthleteId }: EmailParams): Promise<string> {
  // Persist to email_log and return the ID
  const emailId = crypto.randomUUID()
  await db.insert(schema.emailLog).values({
    id: emailId,
    to,
    subject,
    body,
    htmlBody: htmlBody ?? null,
    lang,
    relatedAthleteId: relatedAthleteId ?? null,
  })

  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`EMAIL STUB [${lang.toUpperCase()}]`)
  console.log(`   To:      ${to}`)
  console.log(`   Subject: ${subject}`)
  console.log(`   Body:`)
  body.split('\n').forEach((line) => console.log(`   ${line}`))
  console.log('═══════════════════════════════════════════════════════════════')

  return emailId
}

export interface EmailContent {
  subject: string
  body: string
  htmlBody: string
}

export async function sendMagicLinkEmail(db: DB, email: string, token: string, baseUrl: string, lang: 'en' | 'fr' = 'en'): Promise<EmailContent> {
  const link = `${baseUrl}/auth/verify?token=${token}`
  const subject = lang === 'fr' ? 'Votre lien de connexion — Atletica Genève' : 'Your login link — Atletica Geneve'
  const body = lang === 'fr'
    ? `Bonjour,\n\nCliquez sur le lien suivant pour vous connecter :\n${link}\n\nCe lien est à usage unique et expire dans 30 minutes.\n\nAtletica Genève`
    : `Hello,\n\nClick the following link to log in:\n${link}\n\nThis link is single-use and expires in 30 minutes.\n\nAtletica Geneve`

  const htmlBody = lang === 'fr'
    ? `<p>Bonjour,</p><p>Cliquez sur le lien suivant pour vous connecter :</p><p><a href="${link}">${link}</a></p><p>Ce lien est à usage unique et expire dans 30 minutes.</p><p>Atletica Genève</p>`
    : `<p>Hello,</p><p>Click the following link to log in:</p><p><a href="${link}">${link}</a></p><p>This link is single-use and expires in 30 minutes.</p><p>Atletica Geneve</p>`

  await sendEmail({ db, to: email, subject, body, htmlBody, lang })
  return { subject, body, htmlBody }
}

export async function sendStatusChangeEmail(
  db: DB,
  email: string,
  athleteName: string,
  status: string,
  portalUrl: string,
  lang: 'en' | 'fr' = 'en',
  magicLinkUrl?: string,
  relatedAthleteId?: string,
): Promise<string> {
  const statusLabels: Record<string, Record<string, string>> = {
    en: {
      to_review: 'Under review',
      agreement_sent: 'Agreement sent',
      counter_offer_sent: 'Counter-offer received',
      confirmed: 'Confirmed',
      rejected: 'Not selected',
      withdrawn: 'Withdrawn',
    },
    fr: {
      to_review: "En cours d'examen",
      agreement_sent: 'Accord envoyé',
      counter_offer_sent: 'Contre-proposition reçue',
      confirmed: 'Confirmé',
      rejected: 'Non retenu',
      withdrawn: 'Retiré',
    },
  }

  const label = statusLabels[lang]?.[status] ?? status
  const subject = lang === 'fr'
    ? `Mise à jour candidature — ${athleteName}`
    : `Application update — ${athleteName}`

  const linkUrl = magicLinkUrl ?? portalUrl
  const linkLabel = lang === 'fr' ? 'Accéder au portail' : 'Access portal'

  const body = lang === 'fr'
    ? `Bonjour,\n\nLa candidature de ${athleteName} a été mise à jour.\nNouveau statut : ${label}\n\nConsultez le portail : ${linkUrl}\n\nAtletica Genève`
    : `Hello,\n\nThe application for ${athleteName} has been updated.\nNew status: ${label}\n\nView the portal: ${linkUrl}\n\nAtletica Geneve`

  const htmlBody = lang === 'fr'
    ? `<p>Bonjour,</p><p>La candidature de <strong>${athleteName}</strong> a été mise à jour.</p><p>Nouveau statut : <strong>${label}</strong></p><p><a href="${linkUrl}">${linkLabel}</a></p><p>Atletica Genève</p>`
    : `<p>Hello,</p><p>The application for <strong>${athleteName}</strong> has been updated.</p><p>New status: <strong>${label}</strong></p><p><a href="${linkUrl}">${linkLabel}</a></p><p>Atletica Geneve</p>`

  return sendEmail({ db, to: email, subject, body, htmlBody, lang, relatedAthleteId })
}
