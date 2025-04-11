import { i18n } from '@lingui/core'
import * as en from '#/locales/en/messages'
import { Locale } from './locales'

export async function activateLocale(locale: Locale) {
  const { messages } = await import(`./${locale}/messages.ts`).catch((e) => {
    console.error('Error loading locale', e)
    return en
  })

  i18n.load(locale, messages)
  i18n.activate(locale)
}
