import { Generated, GeneratedAlways } from 'kysely'

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
  lastUpdatedBy: string
}

export type PartialDB = {
  [communicationTemplateTableName]: CommunicationTemplate
}
