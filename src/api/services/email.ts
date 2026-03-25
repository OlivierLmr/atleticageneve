/**
 * Email service stub — logs to console instead of sending actual emails.
 * Replace with a real provider (Resend, SendGrid, etc.) for production.
 */

interface EmailParams {
  to: string
  subject: string
  body: string
  lang?: 'en' | 'fr'
}

export function sendEmail({ to, subject, body, lang = 'en' }: EmailParams): void {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`📧 EMAIL STUB [${lang.toUpperCase()}]`)
  console.log(`   To:      ${to}`)
  console.log(`   Subject: ${subject}`)
  console.log(`   Body:`)
  body.split('\n').forEach((line) => console.log(`   ${line}`))
  console.log('═══════════════════════════════════════════════════════════════')
}

export function sendMagicLinkEmail(email: string, token: string, baseUrl: string, lang: 'en' | 'fr' = 'en'): void {
  const link = `${baseUrl}/auth/verify?token=${token}`
  const subject = lang === 'fr' ? 'Votre lien de connexion — Atletica Genève' : 'Your login link — Atletica Geneve'
  const body = lang === 'fr'
    ? `Bonjour,\n\nCliquez sur le lien suivant pour vous connecter :\n${link}\n\nCe lien expire dans 30 minutes.\n\nAtletica Genève`
    : `Hello,\n\nClick the following link to log in:\n${link}\n\nThis link expires in 30 minutes.\n\nAtletica Geneve`

  sendEmail({ to: email, subject, body, lang })
}

export function sendStatusChangeEmail(
  email: string,
  athleteName: string,
  status: string,
  portalUrl: string,
  lang: 'en' | 'fr' = 'en'
): void {
  const statusLabels: Record<string, Record<string, string>> = {
    en: {
      to_review: 'Under review',
      contract_sent: 'Offer sent',
      counter_offer: 'Counter-offer received',
      accepted: 'Confirmed',
      rejected: 'Not selected',
      withdrawn: 'Withdrawn',
    },
    fr: {
      to_review: "En cours d'examen",
      contract_sent: 'Offre envoyée',
      counter_offer: 'Contre-proposition reçue',
      accepted: 'Confirmé',
      rejected: 'Non retenu',
      withdrawn: 'Retiré',
    },
  }

  const label = statusLabels[lang]?.[status] ?? status
  const subject = lang === 'fr'
    ? `Mise à jour candidature — ${athleteName}`
    : `Application update — ${athleteName}`
  const body = lang === 'fr'
    ? `Bonjour,\n\nLa candidature de ${athleteName} a été mise à jour.\nNouveau statut : ${label}\n\nConsultez le portail : ${portalUrl}\n\nAtletica Genève`
    : `Hello,\n\nThe application for ${athleteName} has been updated.\nNew status: ${label}\n\nView the portal: ${portalUrl}\n\nAtletica Geneve`

  sendEmail({ to: email, subject, body, lang })
}
