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
  lang?: 'en' | 'fr'
  relatedAthleteId?: string
}

export async function sendEmail({ db, to, subject, body, lang = 'en', relatedAthleteId }: EmailParams): Promise<void> {
  // Persist to email_log
  await db.insert(schema.emailLog).values({
    to,
    subject,
    body,
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
}

export async function sendMagicLinkEmail(db: DB, email: string, token: string, baseUrl: string, lang: 'en' | 'fr' = 'en'): Promise<void> {
  const link = `${baseUrl}/auth/verify?token=${token}`
  const subject = lang === 'fr' ? 'Votre lien de connexion — Atletica Genève' : 'Your login link — Atletica Geneve'
  const body = lang === 'fr'
    ? `Bonjour,\n\nCliquez sur le lien suivant pour vous connecter :\n${link}\n\nCe lien est à usage unique et expire dans 30 minutes.\n\nAtletica Genève`
    : `Hello,\n\nClick the following link to log in:\n${link}\n\nThis link is single-use and expires in 30 minutes.\n\nAtletica Geneve`

  await sendEmail({ db, to: email, subject, body, lang })
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
): Promise<void> {
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

  const linkLine = magicLinkUrl
    ? (lang === 'fr'
      ? `\nAccédez directement à votre portail : ${magicLinkUrl}`
      : `\nAccess your portal directly: ${magicLinkUrl}`)
    : (lang === 'fr'
      ? `\nConsultez le portail : ${portalUrl}`
      : `\nView the portal: ${portalUrl}`)

  const body = lang === 'fr'
    ? `Bonjour,\n\nLa candidature de ${athleteName} a été mise à jour.\nNouveau statut : ${label}${linkLine}\n\nAtletica Genève`
    : `Hello,\n\nThe application for ${athleteName} has been updated.\nNew status: ${label}${linkLine}\n\nAtletica Geneve`

  await sendEmail({ db, to: email, subject, body, lang, relatedAthleteId })
}
