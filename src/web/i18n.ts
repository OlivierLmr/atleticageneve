import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '@shared/i18n/en.json'
import fr from '@shared/i18n/fr.json'

const savedLang = typeof window !== 'undefined'
  ? localStorage.getItem('lang') ?? navigator.language.startsWith('fr') ? 'fr' : 'en'
  : 'en'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    lng: savedLang,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

export default i18n
