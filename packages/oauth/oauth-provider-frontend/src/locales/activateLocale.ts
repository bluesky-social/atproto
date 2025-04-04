import { i18n } from '@lingui/core'
import * as en from '#/locales/en/messages'
import { Locale } from '#/locales/types'

export async function activateLocale(locale: Locale) {
  let loadedLocale = en

  switch (locale) {
    case Locale['en-GB']: {
      loadedLocale = await import(`./en-GB/messages`)
      break
    }
    case Locale.fr: {
      loadedLocale = await import(`./fr/messages`)
      break
    }
    default:
      break
  }

  i18n.load(locale, loadedLocale.messages)
  i18n.activate(locale)
}
