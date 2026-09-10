import type { Generated, GeneratedAlways } from 'kysely'
import type { DidString } from '@atproto/lex'

export const communicationTemplateTableName = 'communication_template'

export interface CommunicationTemplate {
  id: GeneratedAlways<number>
  name: string
  contentMarkdown: string
  subject: string | null
  lang: string | null
  disabled: Generated<boolean>
  createdAt: Date
  updatedAt: Date
  lastUpdatedBy: DidString
}

export type PartialDB = {
  [communicationTemplateTableName]: CommunicationTemplate
}
