/**
 * Email service stub — logs to console and persists to email_log table.
 * Replace with a real provider (Resend, SendGrid, etc.) for production.
 */

import type { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '../db/schema'
import type { NegotiationStatus } from '@shared/types'

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

export interface TransitionEmail {
  subject: string
  body: string
}

export function buildTransitionEmail(params: {
  from: NegotiationStatus
  to: NegotiationStatus
  athleteName: string
  meetingName: string
  senderName: string
  recipientName: string
  organizationName: string
  agreementTerms?: string
  counterOfferText?: string
}): TransitionEmail | null {
  const { from, to, athleteName, meetingName, senderName, recipientName, organizationName, agreementTerms, counterOfferText } = params
  const key = `${from}__${to}`

  switch (key) {
    case 'to_review__agreement_sent': {
      const termsSection = agreementTerms
        ? `\n\nHere are the terms of our offer:\n\n${agreementTerms}`
        : ''
      return {
        subject: `${meetingName} — Participation Agreement`,
        body: `Dear ${recipientName},\n\nWe are pleased to inform you that we have reviewed ${athleteName}'s application for ${meetingName} and are ready to move forward with a participation offer.${termsSection}\n\nPlease let us know your decision at your earliest convenience. Should you have any questions or wish to discuss any aspect of the offer, please do not hesitate to reach out.\n\nKind regards,\n${senderName} — ${organizationName}`,
      }
    }
    case 'to_review__rejected':
      return {
        subject: `${meetingName} — Application Update`,
        body: `Dear ${recipientName},\n\nThank you for ${athleteName}'s interest in participating in ${meetingName}.\n\nAfter careful review, we regret to inform you that we are unable to offer a place at this edition of the meeting.\n\nWe sincerely appreciate your trust and hope to have the opportunity to welcome ${athleteName} at a future event.\n\nKind regards,\n${senderName} — ${organizationName}`,
      }
    case 'to_review__withdrawn':
      return {
        subject: `${meetingName} — Withdrawal of Application`,
        body: `Dear ${recipientName},\n\nI am writing to inform you that ${athleteName} is withdrawing their application for ${meetingName}.\n\nWe are sorry for any inconvenience this may cause and thank you for your understanding. We hope to have the opportunity to work together at a future event.\n\nKind regards,\n${senderName}`,
      }
    case 'agreement_sent__confirmed':
      return {
        subject: `${meetingName} — Agreement Accepted`,
        body: `Dear ${recipientName},\n\nWe are delighted to confirm ${athleteName}'s participation in ${meetingName} on the terms set out in the agreement.\n\nWe look forward to the event and thank you for the opportunity.\n\nKind regards,\n${senderName}`,
      }
    case 'agreement_sent__counter_offer_sent': {
      const counterSection = counterOfferText
        ? `\n\nHere is our counter-proposal:\n\n${counterOfferText}`
        : '\n\nPlease find our counter-offer attached.'
      return {
        subject: `${meetingName} — Counter-offer`,
        body: `Dear ${recipientName},\n\nThank you for sending the participation agreement for ${athleteName} at ${meetingName}.\n\nHaving reviewed the proposed terms, we would like to suggest some adjustments.${counterSection}\n\nWe remain open to discussion and look forward to reaching a mutually satisfactory agreement.\n\nKind regards,\n${senderName}`,
      }
    }
    case 'agreement_sent__withdrawn':
      return {
        subject: `${meetingName} — Withdrawal`,
        body: `Dear ${recipientName},\n\nAfter careful consideration, we regret to inform you that ${athleteName} must withdraw from ${meetingName}.\n\nWe are sorry for any inconvenience this may cause and sincerely thank you for the opportunity that was extended. We hope to be able to collaborate at a future event.\n\nKind regards,\n${senderName}`,
      }
    case 'counter_offer_sent__agreement_sent': {
      const termsSection = agreementTerms
        ? `\n\nHere are the revised terms:\n\n${agreementTerms}`
        : ''
      return {
        subject: `${meetingName} — Updated Participation Agreement`,
        body: `Dear ${recipientName},\n\nThank you for your counter-offer regarding ${athleteName}'s participation in ${meetingName}. We have taken your points into consideration and are pleased to send you an updated participation offer.${termsSection}\n\nWe hope this revised proposal meets your expectations. Please do not hesitate to contact us if you have any further questions.\n\nKind regards,\n${senderName} — ${organizationName}`,
      }
    }
    case 'counter_offer_sent__rejected':
      return {
        subject: `${meetingName} — End of Negotiations`,
        body: `Dear ${recipientName},\n\nThank you for your counter-offer regarding ${athleteName}'s participation in ${meetingName}.\n\nAfter careful consideration, we regret to inform you that we are unable to reach an agreement for this edition of the meeting.\n\nWe sincerely value your interest and hope to have the opportunity to work together in the future.\n\nKind regards,\n${senderName} — ${organizationName}`,
      }
    case 'counter_offer_sent__withdrawn':
      return {
        subject: `${meetingName} — Withdrawal`,
        body: `Dear ${recipientName},\n\nFurther to our counter-offer, we have decided to withdraw ${athleteName}'s candidacy for ${meetingName}.\n\nWe thank you for the time and effort devoted to the negotiation and apologize for any inconvenience caused. We hope to have the pleasure of working together at a future event.\n\nKind regards,\n${senderName}`,
      }
    case 'confirmed__withdrawn':
      return {
        subject: `${meetingName} — Withdrawal of Confirmed Participation`,
        body: `Dear ${recipientName},\n\nWe regret to inform you that ${athleteName} is unfortunately forced to withdraw from ${meetingName}, despite having previously confirmed their participation.\n\nWe sincerely apologize for the disruption this may cause to your event organization and thank you for your understanding. Please do not hesitate to contact us if you need any further information.\n\nKind regards,\n${senderName}`,
      }
    case 'confirmed__rejected':
      return {
        subject: `${meetingName} — Update Regarding ${athleteName}'s Participation`,
        body: `Dear ${recipientName},\n\nWe regret to inform you that, due to exceptional circumstances, ${athleteName}'s confirmed participation in ${meetingName} has had to be cancelled.\n\nWe are truly sorry for the inconvenience this causes and want to assure you that this decision was not taken lightly. We remain available to discuss this matter and hope to have the opportunity to welcome ${athleteName} at a future event.\n\nKind regards,\n${senderName} — ${organizationName}`,
      }
    case 'rejected__to_review':
      return {
        subject: `${meetingName} — Application Reopened`,
        body: `Dear ${recipientName},\n\nFollowing our previous communication, we are pleased to inform you that ${athleteName}'s application for ${meetingName} has been reopened.\n\nWe would like to invite you to resume discussions with us. Please feel free to contact us at your convenience.\n\nKind regards,\n${senderName} — ${organizationName}`,
      }
    case 'withdrawn__to_review':
      return {
        subject: `${meetingName} — Invitation to Reconsider`,
        body: `Dear ${recipientName},\n\nFollowing ${athleteName}'s withdrawal from ${meetingName}, we would like to reach out and explore whether there might be an opportunity to resume the process.\n\nIf circumstances have changed and you would be open to reconsidering, we would be very pleased to discuss this with you. Please feel free to contact us.\n\nKind regards,\n${senderName} — ${organizationName}`,
      }
    default:
      return null
  }
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
