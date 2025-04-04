import { i18n } from '@lingui/core'
import { messages } from './en/messages'
import { Locale } from './types'

i18n.load(Locale.en, messages)
i18n.activate(Locale.en)
