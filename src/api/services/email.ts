/**
 * Email service stub — logs to console and persists to email_log table.
 * Replace with a real provider (Resend, SendGrid, etc.) for production.
 */

import * as schema from '../db/schema'
import type { Db } from '../lib/helpers'
import type { NegotiationStatus } from '@shared/types'

interface EmailParams {
  db: Db
  to: string
  subject: string
  body: string
  htmlBody?: string
  lang?: 'en' | 'fr'
  relatedAthleteId?: string
}

export async function sendEmail({ db, to, subject, body, htmlBody, lang = 'en', relatedAthleteId }: EmailParams): Promise<string> {
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

function linkButton(link: string, label: string): string {
  return `<p style="margin:20px 0;text-align:center"><a href="${link}" style="display:inline-block;padding:12px 28px;background:#1a1a1a;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px">${label}</a></p>`
}

function textToHtml(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const paragraphs = escaped.split(/\n{2,}/).map(block => `<p>${block.replace(/\n/g, '<br/>')}</p>`).join('\n')
  return `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#333">${paragraphs}</div>`
}

// ── Case (a): athlete self-registration ──────────────────────────────────────
export async function sendApplicationEmail(
  db: Db, email: string, token: string, baseUrl: string, lang: 'en' | 'fr' = 'en', meetingName = 'Atletica Geneve'
): Promise<EmailContent> {
  const link = `${baseUrl}/auth/verify?token=${token}`
  const subject = lang === 'fr'
    ? `${meetingName} — Votre candidature`
    : `${meetingName} — Your Application`

  const body = lang === 'fr'
    ? `Chère athlète, cher athlète,\n\nNous avons bien reçu votre demande de participation à ${meetingName} et nous vous en remercions chaleureusement.\n\nVotre candidature sera examinée avec la plus grande attention par l'équipe d'Atletica Genève. Nous étudions chaque dossier avec soin afin d'offrir le meilleur meeting possible.\n\nPour suivre l'avancement de votre candidature, vous pouvez accéder à votre espace personnel en cliquant sur le lien ci-dessous :\n\n${link}\n\nCe lien est à usage unique et expire dans 30 minutes. Vous continuerez naturellement à être informé(e) par email à chaque étape importante de votre dossier.\n\nNous vous souhaitons bonne chance et espérons avoir le plaisir de vous accueillir à Genève.\n\nBien cordialement,\nL'équipe Atletica Genève`
    : `Dear athlete,\n\nWe have received your request to participate in ${meetingName} and we sincerely thank you for your interest.\n\nYour application will be carefully reviewed by the Atletica Geneve team. We take great care in examining every submission to ensure the best possible meeting.\n\nTo follow the progress of your application, you can access your personal portal by clicking the link below:\n\n${link}\n\nThis link is single-use and expires in 30 minutes. You will of course continue to be informed by email at every important stage of your application.\n\nWe wish you the best of luck and hope to have the pleasure of welcoming you to Geneva.\n\nWarm regards,\nThe Atletica Geneve Team`

  const htmlBody = lang === 'fr'
    ? `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#333"><p>Chère athlète, cher athlète,</p><p>Nous avons bien reçu votre demande de participation à <strong>${meetingName}</strong> et nous vous en remercions chaleureusement.</p><p>Votre candidature sera examinée avec la plus grande attention par l'équipe d'Atletica Genève. Nous étudions chaque dossier avec soin afin d'offrir le meilleur meeting possible.</p><p>Pour suivre l'avancement de votre candidature, accédez à votre espace personnel :</p>${linkButton(link, 'Accéder à mon espace')}<p style="font-size:12px;color:#666"><em>Ce lien est à usage unique et expire dans 30 minutes.</em></p><p>Nous vous souhaitons bonne chance et espérons avoir le plaisir de vous accueillir à Genève.</p><p>Bien cordialement,<br/>L'équipe Atletica Genève</p></div>`
    : `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#333"><p>Dear athlete,</p><p>We have received your request to participate in <strong>${meetingName}</strong> and we sincerely thank you for your interest.</p><p>Your application will be carefully reviewed by the Atletica Geneve team. We take great care in examining every submission to ensure the best possible meeting.</p><p>To follow the progress of your application, access your personal portal:</p>${linkButton(link, 'Access my portal')}<p style="font-size:12px;color:#666"><em>This link is single-use and expires in 30 minutes.</em></p><p>We wish you the best of luck and hope to have the pleasure of welcoming you to Geneva.</p><p>Warm regards,<br/>The Atletica Geneve Team</p></div>`

  await sendEmail({ db, to: email, subject, body, htmlBody, lang })
  return { subject, body, htmlBody }
}

// ── Cases (b)(c): existing user login link ────────────────────────────────────
export async function sendLoginLinkEmail(
  db: Db, email: string, token: string, baseUrl: string, lang: 'en' | 'fr' = 'en', meetingName = 'Atletica Geneve'
): Promise<EmailContent> {
  const link = `${baseUrl}/auth/verify?token=${token}`
  const subject = lang === 'fr'
    ? `${meetingName} — Votre lien de connexion`
    : `${meetingName} — Your login link`

  const body = lang === 'fr'
    ? `Bonjour,\n\nVoici votre lien de connexion pour accéder à votre espace ${meetingName} :\n\n${link}\n\nCe lien est à usage unique et expire dans 30 minutes.\n\nSi vous n'avez pas demandé ce lien, vous pouvez ignorer cet email.\n\nBien cordialement,\nL'équipe Atletica Genève`
    : `Hello,\n\nHere is your login link to access your ${meetingName} portal:\n\n${link}\n\nThis link is single-use and expires in 30 minutes.\n\nIf you did not request this link, you may safely ignore this email.\n\nWarm regards,\nThe Atletica Geneve Team`

  const htmlBody = lang === 'fr'
    ? `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#333"><p>Bonjour,</p><p>Voici votre lien de connexion pour accéder à votre espace <strong>${meetingName}</strong> :</p>${linkButton(link, 'Se connecter')}<p style="font-size:12px;color:#666"><em>Ce lien est à usage unique et expire dans 30 minutes. Si vous n'avez pas demandé ce lien, vous pouvez ignorer cet email.</em></p><p>Bien cordialement,<br/>L'équipe Atletica Genève</p></div>`
    : `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#333"><p>Hello,</p><p>Here is your login link to access your <strong>${meetingName}</strong> portal:</p>${linkButton(link, 'Log in')}<p style="font-size:12px;color:#666"><em>This link is single-use and expires in 30 minutes. If you did not request this link, you may safely ignore this email.</em></p><p>Warm regards,<br/>The Atletica Geneve Team</p></div>`

  await sendEmail({ db, to: email, subject, body, htmlBody, lang })
  return { subject, body, htmlBody }
}

// ── Manager notification: new athlete registered under management ─────────────
export function buildManagerAthleteNotificationEmail(params: {
  managerName: string
  athleteFirstName: string
  athleteLastName: string
  meetingName: string
  eventIds: string[]
}): EmailContent {
  const { managerName, athleteFirstName, athleteLastName, meetingName, eventIds } = params
  const athleteName = `${athleteFirstName} ${athleteLastName}`
  const subject = `${meetingName} — New athlete registered under your management: ${athleteName}`

  const body = `Dear ${managerName},\n\nA new athlete has registered for ${meetingName} and listed you as their manager.\n\nAthlete: ${athleteName}\nEvents: ${eventIds.join(', ')}\n\nYou can follow the progress of ${athleteName}'s application in your manager portal.\n\nKind regards,\nThe Atletica Geneve Team`

  const htmlBody = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#333"><p>Dear ${managerName},</p><p>A new athlete has registered for <strong>${meetingName}</strong> and listed you as their manager.</p><table style="border-collapse:collapse;margin:12px 0"><tr><td style="padding:4px 8px;font-weight:600">Athlete:</td><td style="padding:4px 8px">${athleteName}</td></tr><tr><td style="padding:4px 8px;font-weight:600">Events:</td><td style="padding:4px 8px">${eventIds.join(', ')}</td></tr></table><p>You can follow the progress of ${athleteName}'s application in your manager portal.</p><p>Kind regards,<br/>The Atletica Geneve Team</p></div>`

  return { subject, body, htmlBody }
}

export interface TransitionEmail {
  subject: string
  body: string
  htmlBody: string
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
  agreementHtmlTerms?: string
  counterOfferText?: string
  magicLinkUrl?: string
}): TransitionEmail | null {
  const { from, to, athleteName, meetingName, senderName, recipientName, organizationName, agreementTerms, agreementHtmlTerms, counterOfferText, magicLinkUrl } = params
  const key = `${from}__${to}`

  const make = (subject: string, body: string): TransitionEmail => ({
    subject,
    body,
    htmlBody: textToHtml(body),
  })

  const makeHtml = (subject: string, body: string, htmlBody: string): TransitionEmail => ({ subject, body, htmlBody })

  const portalButton = magicLinkUrl
    ? `${linkButton(magicLinkUrl, 'Access my portal')}<p style="font-size:12px;color:#666"><em>This link is valid for 48 hours and can only be used once.</em></p>`
    : ''

  const portalText = magicLinkUrl
    ? `\n\nYou can access your portal directly using the link below:\n${magicLinkUrl}\n(This link is valid for 48 hours and can only be used once.)`
    : ''

  switch (key) {
    case 'to_review__agreement_sent': {
      const termsSection = agreementTerms
        ? `\n\nHere are the terms of our offer:\n\n${agreementTerms}`
        : ''
      const subject = `${meetingName} — Participation Agreement`
      const body = `Dear ${recipientName},\n\nWe are pleased to inform you that we have reviewed ${athleteName}'s application for ${meetingName} and are ready to move forward with a participation offer.${termsSection}\n\nPlease let us know your decision at your earliest convenience. Should you have any questions or wish to discuss any aspect of the offer, please do not hesitate to reach out.${portalText}\n\nKind regards,\n${senderName} — ${organizationName}`
      if (agreementHtmlTerms) {
        const htmlBody = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#333"><p>Dear ${recipientName},</p><p>We are pleased to inform you that we have reviewed <strong>${athleteName}</strong>'s application for <strong>${meetingName}</strong> and are ready to move forward with a participation offer.</p>${agreementHtmlTerms}<p>Please let us know your decision at your earliest convenience. Should you have any questions or wish to discuss any aspect of the offer, please do not hesitate to reach out.</p>${portalButton}<p>Kind regards,<br/>${senderName} — ${organizationName}</p></div>`
        return makeHtml(subject, body, htmlBody)
      }
      const htmlBody = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#333"><p>Dear ${recipientName},</p><p>We are pleased to inform you that we have reviewed <strong>${athleteName}</strong>'s application for <strong>${meetingName}</strong> and are ready to move forward with a participation offer.</p><p>Please let us know your decision at your earliest convenience. Should you have any questions or wish to discuss any aspect of the offer, please do not hesitate to reach out.</p>${portalButton}<p>Kind regards,<br/>${senderName} — ${organizationName}</p></div>`
      return makeHtml(subject, body, htmlBody)
    }
    case 'to_review__rejected':
      return make(
        `${meetingName} — Application Update`,
        `Dear ${recipientName},\n\nThank you for ${athleteName}'s interest in participating in ${meetingName}.\n\nAfter careful review, we regret to inform you that we are unable to offer a place at this edition of the meeting.\n\nWe sincerely appreciate your trust and hope to have the opportunity to welcome ${athleteName} at a future event.\n\nKind regards,\n${senderName} — ${organizationName}`,
      )
    case 'to_review__withdrawn':
      return make(
        `${meetingName} — Withdrawal of Application`,
        `Dear ${recipientName},\n\nI am writing to inform you that ${athleteName} is withdrawing their application for ${meetingName}.\n\nWe are sorry for any inconvenience this may cause and thank you for your understanding. We hope to have the opportunity to work together at a future event.\n\nKind regards,\n${senderName}`,
      )
    case 'agreement_sent__confirmed':
      return make(
        `${meetingName} — Agreement Accepted`,
        `Dear ${recipientName},\n\nWe are delighted to confirm ${athleteName}'s participation in ${meetingName} on the terms set out in the agreement.\n\nWe look forward to the event and thank you for the opportunity.\n\nKind regards,\n${senderName}`,
      )
    case 'agreement_sent__counter_offer_sent': {
      const counterSection = counterOfferText
        ? `\n\nHere is our counter-proposal:\n\n${counterOfferText}`
        : '\n\nPlease find our counter-offer attached.'
      return make(
        `${meetingName} — Counter-offer`,
        `Dear ${recipientName},\n\nThank you for sending the participation agreement for ${athleteName} at ${meetingName}.\n\nHaving reviewed the proposed terms, we would like to suggest some adjustments.${counterSection}\n\nWe remain open to discussion and look forward to reaching a mutually satisfactory agreement.\n\nKind regards,\n${senderName}`,
      )
    }
    case 'agreement_sent__withdrawn':
      return make(
        `${meetingName} — Withdrawal`,
        `Dear ${recipientName},\n\nAfter careful consideration, we regret to inform you that ${athleteName} must withdraw from ${meetingName}.\n\nWe are sorry for any inconvenience this may cause and sincerely thank you for the opportunity that was extended. We hope to be able to collaborate at a future event.\n\nKind regards,\n${senderName}`,
      )
    case 'counter_offer_sent__agreement_sent': {
      const termsSection = agreementTerms
        ? `\n\nHere are the revised terms:\n\n${agreementTerms}`
        : ''
      const subject = `${meetingName} — Updated Participation Agreement`
      const body = `Dear ${recipientName},\n\nThank you for your counter-offer regarding ${athleteName}'s participation in ${meetingName}. We have taken your points into consideration and are pleased to send you an updated participation offer.${termsSection}\n\nWe hope this revised proposal meets your expectations. Please do not hesitate to contact us if you have any further questions.${portalText}\n\nKind regards,\n${senderName} — ${organizationName}`
      if (agreementHtmlTerms) {
        const htmlBody = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#333"><p>Dear ${recipientName},</p><p>Thank you for your counter-offer regarding <strong>${athleteName}</strong>'s participation in <strong>${meetingName}</strong>. We have taken your points into consideration and are pleased to send you an updated participation offer.</p>${agreementHtmlTerms}<p>We hope this revised proposal meets your expectations. Please do not hesitate to contact us if you have any further questions.</p>${portalButton}<p>Kind regards,<br/>${senderName} — ${organizationName}</p></div>`
        return makeHtml(subject, body, htmlBody)
      }
      const htmlBody = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#333"><p>Dear ${recipientName},</p><p>Thank you for your counter-offer regarding <strong>${athleteName}</strong>'s participation in <strong>${meetingName}</strong>. We have taken your points into consideration and are pleased to send you an updated participation offer.</p><p>We hope this revised proposal meets your expectations. Please do not hesitate to contact us if you have any further questions.</p>${portalButton}<p>Kind regards,<br/>${senderName} — ${organizationName}</p></div>`
      return makeHtml(subject, body, htmlBody)
    }
    case 'counter_offer_sent__rejected':
      return make(
        `${meetingName} — End of Negotiations`,
        `Dear ${recipientName},\n\nThank you for your counter-offer regarding ${athleteName}'s participation in ${meetingName}.\n\nAfter careful consideration, we regret to inform you that we are unable to reach an agreement for this edition of the meeting.\n\nWe sincerely value your interest and hope to have the opportunity to work together in the future.\n\nKind regards,\n${senderName} — ${organizationName}`,
      )
    case 'counter_offer_sent__withdrawn':
      return make(
        `${meetingName} — Withdrawal`,
        `Dear ${recipientName},\n\nFurther to our counter-offer, we have decided to withdraw ${athleteName}'s candidacy for ${meetingName}.\n\nWe thank you for the time and effort devoted to the negotiation and apologize for any inconvenience caused. We hope to have the pleasure of working together at a future event.\n\nKind regards,\n${senderName}`,
      )
    case 'confirmed__withdrawn':
      return make(
        `${meetingName} — Withdrawal of Confirmed Participation`,
        `Dear ${recipientName},\n\nWe regret to inform you that ${athleteName} is unfortunately forced to withdraw from ${meetingName}, despite having previously confirmed their participation.\n\nWe sincerely apologize for the disruption this may cause to your event organization and thank you for your understanding. Please do not hesitate to contact us if you need any further information.\n\nKind regards,\n${senderName}`,
      )
    case 'confirmed__rejected':
      return make(
        `${meetingName} — Update Regarding ${athleteName}'s Participation`,
        `Dear ${recipientName},\n\nWe regret to inform you that, due to exceptional circumstances, ${athleteName}'s confirmed participation in ${meetingName} has had to be cancelled.\n\nWe are truly sorry for the inconvenience this causes and want to assure you that this decision was not taken lightly. We remain available to discuss this matter and hope to have the opportunity to welcome ${athleteName} at a future event.\n\nKind regards,\n${senderName} — ${organizationName}`,
      )
    case 'rejected__to_review': {
      const subject = `${meetingName} — Application Reopened`
      const body = `Dear ${recipientName},\n\nFollowing our previous communication, we are pleased to inform you that ${athleteName}'s application for ${meetingName} has been reopened.\n\nWe would like to invite you to resume discussions with us. Please feel free to contact us at your convenience.${portalText}\n\nKind regards,\n${senderName} — ${organizationName}`
      const htmlBody = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#333"><p>Dear ${recipientName},</p><p>Following our previous communication, we are pleased to inform you that <strong>${athleteName}</strong>'s application for <strong>${meetingName}</strong> has been reopened.</p><p>We would like to invite you to resume discussions with us. Please feel free to contact us at your convenience.</p>${portalButton}<p>Kind regards,<br/>${senderName} — ${organizationName}</p></div>`
      return makeHtml(subject, body, htmlBody)
    }
    case 'withdrawn__to_review': {
      const subject = `${meetingName} — Invitation to Reconsider`
      const body = `Dear ${recipientName},\n\nFollowing ${athleteName}'s withdrawal from ${meetingName}, we would like to reach out and explore whether there might be an opportunity to resume the process.\n\nIf circumstances have changed and you would be open to reconsidering, we would be very pleased to discuss this with you. Please feel free to contact us.${portalText}\n\nKind regards,\n${senderName} — ${organizationName}`
      const htmlBody = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#333"><p>Dear ${recipientName},</p><p>Following <strong>${athleteName}</strong>'s withdrawal from <strong>${meetingName}</strong>, we would like to reach out and explore whether there might be an opportunity to resume the process.</p><p>If circumstances have changed and you would be open to reconsidering, we would be very pleased to discuss this with you. Please feel free to contact us.</p>${portalButton}<p>Kind regards,<br/>${senderName} — ${organizationName}</p></div>`
      return makeHtml(subject, body, htmlBody)
    }
    default:
      return null
  }
}

// ── Batch registration confirmation (manager) ─────────────────────────────────
export function buildBatchNotificationEmail(params: {
  managerName: string
  meetingName: string
  athletes: Array<{ firstName: string; lastName: string; eventIds: string[] }>
}): EmailContent {
  const { managerName, meetingName, athletes } = params
  const count = athletes.length
  const plural = count > 1

  const athleteList = athletes
    .map(a => `  - ${a.firstName} ${a.lastName} (${a.eventIds.join(', ')})`)
    .join('\n')

  const subject = `${meetingName} — Batch registration complete — ${count} athlete${plural ? 's' : ''}`

  const body = `Dear ${managerName},\n\nWe are pleased to confirm that your batch registration for ${meetingName} has been processed successfully.\n\nThe following ${count} athlete${plural ? 's have' : ' has'} been registered:\n\n${athleteList}\n\nEach application has been submitted and is now under review. You will be kept informed of any updates regarding the status of each athlete's participation.\n\nShould you have any questions or need to make changes, please do not hesitate to contact us.\n\nKind regards,\nThe Atletica Geneve Team`

  const htmlRows = athletes
    .map(a => `<tr><td style="padding:4px 8px">${a.firstName} ${a.lastName}</td><td style="padding:4px 8px;color:#666">${a.eventIds.join(', ')}</td></tr>`)
    .join('\n')

  const htmlBody = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#333"><p>Dear ${managerName},</p><p>We are pleased to confirm that your batch registration for <strong>${meetingName}</strong> has been processed successfully.</p><p>The following ${count} athlete${plural ? 's have' : ' has'} been registered:</p><table style="border-collapse:collapse;width:100%;margin:12px 0"><thead><tr style="background:#f5f5f5"><th style="padding:6px 8px;text-align:left;border-bottom:1px solid #ddd">Athlete</th><th style="padding:6px 8px;text-align:left;border-bottom:1px solid #ddd">Events</th></tr></thead><tbody>${htmlRows}</tbody></table><p>Each application has been submitted and is now under review. You will be kept informed of any updates regarding the status of each athlete's participation.</p><p>Should you have any questions or need to make changes, please do not hesitate to contact us.</p><p>Kind regards,<br/>The Atletica Geneve Team</p></div>`

  return { subject, body, htmlBody }
}

// ── Payment proforma (to manager or athlete) ──────────────────────────────────

export function buildPaymentProformaEmail(params: {
  recipientName: string
  athleteFirstName: string
  athleteLastName: string
  meetingName: string
  currency: string
  appearanceFee: number
  otherCompensation: number
  otherCompensationDesc: string | null
  events: Array<{ eventName: string; finalPlacement: number | null; prizeMoney: number }>
  totalDue: number
  recipientIban: string | null
  portalLink: string
}): EmailContent {
  const {
    recipientName,
    athleteFirstName,
    athleteLastName,
    meetingName,
    currency,
    appearanceFee,
    otherCompensation,
    otherCompensationDesc,
    events,
    totalDue,
    recipientIban,
    portalLink,
  } = params
  const athleteName = `${athleteFirstName} ${athleteLastName}`

  const subject = `${meetingName} — Payment summary for ${athleteName}`

  const ibanSection = recipientIban
    ? `Your IBAN on file: ${recipientIban}`
    : `IMPORTANT: We do not have your IBAN on file. Please log in to your portal and update your banking details so we can process the payment: ${portalLink}`

  const eventLines = events
    .map(e => `  - ${e.eventName}${e.finalPlacement != null ? ` (place: ${e.finalPlacement})` : ''}: ${e.prizeMoney > 0 ? `${currency} ${e.prizeMoney.toLocaleString()} prize money` : 'no prize money'}`)
    .join('\n')

  const body = `Dear ${recipientName},

Following ${meetingName}, please find below a summary of the amounts owed to ${athleteName}. We kindly ask you to issue an invoice to Atletica Genève for the total amount indicated.

PAYMENT SUMMARY
───────────────
Athlete: ${athleteName}
Meeting: ${meetingName}

Line items:
${appearanceFee > 0 ? `  - Appearance fee: ${currency} ${appearanceFee.toLocaleString()}\n` : ''}${eventLines}${otherCompensation > 0 ? `\n  - Other compensation${otherCompensationDesc ? ` (${otherCompensationDesc})` : ''}: ${currency} ${otherCompensation.toLocaleString()}` : ''}

TOTAL DUE: ${currency} ${totalDue.toLocaleString()}

${ibanSection}

Please issue an invoice to:
  Atletica Genève
  For the attention of: Finance Department

Thank you,
The Atletica Genève Organisation Committee`

  const eventHtmlRows = events
    .map(e => `<tr><td style="padding:4px 8px">${e.eventName}${e.finalPlacement != null ? ` <span style="color:#666">(place: ${e.finalPlacement})</span>` : ''}</td><td style="padding:4px 8px;text-align:right">${e.prizeMoney > 0 ? `${currency} ${e.prizeMoney.toLocaleString()}` : '—'}</td></tr>`)
    .join('')

  const ibanHtml = recipientIban
    ? `<p><strong>Your IBAN on file:</strong> <code>${recipientIban}</code></p>`
    : `<p style="color:#b45309;background:#fef3c7;padding:10px;border-radius:6px">⚠️ <strong>We do not have your IBAN on file.</strong> Please log in to your portal and update your banking details so we can process the payment: <a href="${portalLink}">${portalLink}</a></p>`

  const htmlBody = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#333">
<p>Dear ${recipientName},</p>
<p>Following <strong>${meetingName}</strong>, please find below a summary of the amounts owed to <strong>${athleteName}</strong>. We kindly ask you to issue an invoice to Atletica Genève for the total amount indicated.</p>

<table style="border-collapse:collapse;width:100%;margin:16px 0;font-size:13px">
  <thead>
    <tr style="background:#f5f5f5">
      <th style="padding:6px 8px;text-align:left;border-bottom:2px solid #ddd">Line item</th>
      <th style="padding:6px 8px;text-align:right;border-bottom:2px solid #ddd">Amount</th>
    </tr>
  </thead>
  <tbody>
    ${appearanceFee > 0 ? `<tr><td style="padding:4px 8px">Appearance fee</td><td style="padding:4px 8px;text-align:right">${currency} ${appearanceFee.toLocaleString()}</td></tr>` : ''}
    ${eventHtmlRows}
    ${otherCompensation > 0 ? `<tr><td style="padding:4px 8px">Other compensation${otherCompensationDesc ? ` (${otherCompensationDesc})` : ''}</td><td style="padding:4px 8px;text-align:right">${currency} ${otherCompensation.toLocaleString()}</td></tr>` : ''}
    <tr style="border-top:2px solid #ddd;font-weight:600">
      <td style="padding:8px">TOTAL DUE</td>
      <td style="padding:8px;text-align:right">${currency} ${totalDue.toLocaleString()}</td>
    </tr>
  </tbody>
</table>

${ibanHtml}

<p>Please issue an invoice to:<br/>
<strong>Atletica Genève</strong><br/>
For the attention of: Finance Department</p>

<p>Thank you,<br/>The Atletica Genève Organisation Committee</p>
</div>`

  return { subject, body, htmlBody }
}

// ── Portal response notification (to organisation committee) ──────────────────
export function buildPortalResponseEmail(params: {
  athleteFirstName: string
  athleteLastName: string
  gender: string
  action: string
  newStatus: string
  meetingName: string
}): EmailContent {
  const { athleteFirstName, athleteLastName, gender, action, newStatus, meetingName } = params
  const athleteName = `${athleteFirstName} ${athleteLastName}`
  const pronoun = gender === 'F' ? 'her' : 'his'

  const actionDescriptions: Record<string, string> = {
    accept: 'accepted the participation offer',
    reject: 'rejected the participation offer',
    withdraw: 'withdrawn from the meeting',
    counter_offer: 'submitted a counter-offer',
  }
  const actionDesc = actionDescriptions[action] ?? `updated their application (${action})`

  const subject = `Application update — ${athleteName}`

  const body = `Dear ATLETICAGENEVE organisation committee,\n\n${athleteName} has ${actionDesc} for ${meetingName}.\n\n${athleteName} has updated ${pronoun} application status, which is now: ${newStatus}.\n\nPlease log in to the management platform to review this update and take any necessary action.\n\nThis is an automated notification from the Atletica Geneve registration system.`

  const htmlBody = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#333"><p>Dear ATLETICAGENEVE organisation committee,</p><p><strong>${athleteName}</strong> has ${actionDesc} for <strong>${meetingName}</strong>.</p><p>${athleteName} has updated ${pronoun} application status, which is now: <strong>${newStatus}</strong>.</p><p>Please log in to the management platform to review this update and take any necessary action.</p><p style="font-size:12px;color:#999">This is an automated notification from the Atletica Geneve registration system.</p></div>`

  return { subject, body, htmlBody }
}
