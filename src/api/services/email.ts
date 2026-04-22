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

export interface TransitionEmailContent {
  subject: string
  body: string
}

/**
 * Builds the email content for a given negotiation status transition.
 * All emails are in English (mail engine not yet active).
 */
export function buildTransitionEmail(
  from: string,
  to: string,
  athleteName: string,
  meetingName: string,
  senderName: string,
  recipientName: string,
  orgName: string = 'Atletica Geneve',
): TransitionEmailContent | null {
  const p = (s: string) => s
    .replace(/\[Meeting Name\]/g, meetingName)
    .replace(/\[Athlete Name\]/g, athleteName)
    .replace(/\[Sender Name\]/g, senderName)
    .replace(/\[Recipient Name\]/g, recipientName)
    .replace(/\[Organization Name\]/g, orgName)

  const key = `${from}__${to}`

  const templates: Record<string, TransitionEmailContent> = {
    'to_review__agreement_sent': {
      subject: p('[Meeting Name] — Participation Agreement'),
      body: p(`Dear [Recipient Name],

We are pleased to inform you that we have reviewed [Athlete Name]'s application for [Meeting Name] and are ready to move forward with a participation offer.

Please find attached the participation agreement for your review. We would be grateful if you could let us know your decision at your earliest convenience.

Should you have any questions or wish to discuss any aspect of the agreement, please do not hesitate to reach out.

We look forward to hearing from you.

Kind regards,
[Sender Name] — [Organization Name]`),
    },

    'to_review__rejected': {
      subject: p('[Meeting Name] — Application Update'),
      body: p(`Dear [Recipient Name],

Thank you for [Athlete Name]'s interest in participating in [Meeting Name].

After careful review, we regret to inform you that we are unable to offer a place at this edition of the meeting.

We sincerely appreciate your trust and hope to have the opportunity to welcome [Athlete Name] at a future event.

Kind regards,
[Sender Name] — [Organization Name]`),
    },

    'to_review__withdrawn': {
      subject: p('[Meeting Name] — Withdrawal of Application'),
      body: p(`Dear [Recipient Name],

I am writing to inform you that [Athlete Name] is withdrawing their application for [Meeting Name].

We are sorry for any inconvenience this may cause and thank you for your understanding. We hope to have the opportunity to work together at a future event.

Kind regards,
[Sender Name]`),
    },

    'agreement_sent__confirmed': {
      subject: p('[Meeting Name] — Agreement Accepted'),
      body: p(`Dear [Recipient Name],

We are delighted to confirm [Athlete Name]'s participation in [Meeting Name] on the terms set out in the agreement.

We look forward to the event and thank you for the opportunity.

Kind regards,
[Sender Name]`),
    },

    'agreement_sent__counter_offer_sent': {
      subject: p('[Meeting Name] — Counter-offer'),
      body: p(`Dear [Recipient Name],

Thank you for sending the participation agreement for [Athlete Name] at [Meeting Name].

Having reviewed the proposed terms, we would like to suggest some adjustments. Please find our counter-offer attached.

We remain open to discussion and look forward to reaching a mutually satisfactory agreement.

Kind regards,
[Sender Name]`),
    },

    'agreement_sent__withdrawn': {
      subject: p('[Meeting Name] — Withdrawal'),
      body: p(`Dear [Recipient Name],

After careful consideration, we regret to inform you that [Athlete Name] must withdraw from [Meeting Name].

We are sorry for any inconvenience this may cause and sincerely thank you for the opportunity that was extended. We hope to be able to collaborate at a future event.

Kind regards,
[Sender Name]`),
    },

    'counter_offer_sent__agreement_sent': {
      subject: p('[Meeting Name] — Updated Participation Agreement'),
      body: p(`Dear [Recipient Name],

Thank you for your counter-offer regarding [Athlete Name]'s participation in [Meeting Name]. We have taken your points into consideration and are pleased to send you an updated participation agreement.

We hope this revised proposal meets your expectations. Please do not hesitate to contact us if you have any further questions.

Kind regards,
[Sender Name] — [Organization Name]`),
    },

    'counter_offer_sent__rejected': {
      subject: p('[Meeting Name] — End of Negotiations'),
      body: p(`Dear [Recipient Name],

Thank you for your counter-offer regarding [Athlete Name]'s participation in [Meeting Name].

After careful consideration, we regret to inform you that we are unable to reach an agreement for this edition of the meeting.

We sincerely value your interest and hope to have the opportunity to work together in the future.

Kind regards,
[Sender Name] — [Organization Name]`),
    },

    'counter_offer_sent__withdrawn': {
      subject: p('[Meeting Name] — Withdrawal'),
      body: p(`Dear [Recipient Name],

Further to our counter-offer, we have decided to withdraw [Athlete Name]'s candidacy for [Meeting Name].

We thank you for the time and effort devoted to the negotiation and apologize for any inconvenience caused. We hope to have the pleasure of working together at a future event.

Kind regards,
[Sender Name]`),
    },

    'confirmed__withdrawn': {
      subject: p('[Meeting Name] — Withdrawal of Confirmed Participation'),
      body: p(`Dear [Recipient Name],

We regret to inform you that [Athlete Name] is unfortunately forced to withdraw from [Meeting Name], despite having previously confirmed their participation.

We sincerely apologize for the disruption this may cause to your event organization and thank you for your understanding. Please do not hesitate to contact us if you need any further information.

Kind regards,
[Sender Name]`),
    },

    'confirmed__rejected': {
      subject: p("[Meeting Name] — Update Regarding [Athlete Name]'s Participation"),
      body: p(`Dear [Recipient Name],

We regret to inform you that, due to exceptional circumstances, [Athlete Name]'s confirmed participation in [Meeting Name] has had to be cancelled.

We are truly sorry for the inconvenience this causes and want to assure you that this decision was not taken lightly. We remain available to discuss this matter and hope to have the opportunity to welcome [Athlete Name] at a future event.

Kind regards,
[Sender Name] — [Organization Name]`),
    },

    'rejected__to_review': {
      subject: p('[Meeting Name] — Application Reopened'),
      body: p(`Dear [Recipient Name],

Following our previous communication, we are pleased to inform you that [Athlete Name]'s application for [Meeting Name] has been reopened.

We would like to invite you to resume discussions with us. Please feel free to contact us at your convenience.

Kind regards,
[Sender Name] — [Organization Name]`),
    },

    'withdrawn__to_review': {
      subject: p('[Meeting Name] — Invitation to Reconsider'),
      body: p(`Dear [Recipient Name],

Following [Athlete Name]'s withdrawal from [Meeting Name], we would like to reach out and explore whether there might be an opportunity to resume the process.

If circumstances have changed and you would be open to reconsidering, we would be very pleased to discuss this with you. Please feel free to contact us.

Kind regards,
[Sender Name] — [Organization Name]`),
    },
  }

  return templates[key] ?? null
}

export async function sendMagicLinkEmail(db: DB, email: string, token: string, baseUrl: string, lang: 'en' | 'fr' = 'en'): Promise<EmailContent> {
  const link = `${baseUrl}/auth/verify?token=${token}`
  const subject = lang === 'fr' ? 'Votre candidature — Atletica Genève' : 'Your application — Atletica Geneve'
  const body = lang === 'fr'
    ? `Chère athlète, cher athlète,\n\nNous avons bien reçu votre demande de participation à Atletica Genève et nous vous en remercions chaleureusement.\n\nVotre candidature sera examinée avec la plus grande attention par l'équipe d'Atletica Genève. Nous étudions chaque dossier avec soin afin d'offrir le meilleur meeting possible.\n\nPour suivre l'avancement de votre candidature, vous pouvez accéder à votre espace personnel en cliquant sur le lien ci-dessous :\n\n${link}\n\nCe lien est à usage unique et expire dans 30 minutes. Vous continuerez naturellement à être informé(e) par email à chaque étape importante de votre dossier.\n\nNous vous souhaitons bonne chance et espérons avoir le plaisir de vous accueillir à Genève.\n\nBien cordialement,\nL'équipe Atletica Genève`
    : `Dear athlete,\n\nWe have received your request to participate in Atletica Geneve and we sincerely thank you for your interest.\n\nYour application will be carefully reviewed by the Atletica Geneve team. We take great care in examining every submission to ensure the best possible meeting.\n\nTo follow the progress of your application, you can access your personal portal by clicking the link below:\n\n${link}\n\nThis link is single-use and expires in 30 minutes. You will of course continue to be informed by email at every important stage of your application.\n\nWe wish you the best of luck and hope to have the pleasure of welcoming you to Geneva.\n\nWarm regards,\nThe Atletica Geneve Team`

  const htmlBody = lang === 'fr'
    ? `<p>Chère athlète, cher athlète,</p><p>Nous avons bien reçu votre demande de participation à <strong>Atletica Genève</strong> et nous vous en remercions chaleureusement.</p><p>Votre candidature sera examinée avec la plus grande attention par l'équipe d'Atletica Genève. Nous étudions chaque dossier avec soin afin d'offrir le meilleur meeting possible.</p><p>Pour suivre l'avancement de votre candidature, vous pouvez accéder à votre espace personnel en cliquant sur le lien ci-dessous :</p><p><a href="${link}">${link}</a></p><p><em>Ce lien est à usage unique et expire dans 30 minutes. Vous continuerez naturellement à être informé(e) par email à chaque étape importante de votre dossier.</em></p><p>Nous vous souhaitons bonne chance et espérons avoir le plaisir de vous accueillir à Genève.</p><p>Bien cordialement,<br/>L'équipe Atletica Genève</p>`
    : `<p>Dear athlete,</p><p>We have received your request to participate in <strong>Atletica Geneve</strong> and we sincerely thank you for your interest.</p><p>Your application will be carefully reviewed by the Atletica Geneve team. We take great care in examining every submission to ensure the best possible meeting.</p><p>To follow the progress of your application, you can access your personal portal by clicking the link below:</p><p><a href="${link}">${link}</a></p><p><em>This link is single-use and expires in 30 minutes. You will of course continue to be informed by email at every important stage of your application.</em></p><p>We wish you the best of luck and hope to have the pleasure of welcoming you to Geneva.</p><p>Warm regards,<br/>The Atletica Geneve Team</p>`

  await sendEmail({ db, to: email, subject, body, htmlBody, lang })
  return { subject, body, htmlBody }
}
