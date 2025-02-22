import { Selectable } from 'kysely'
import { Database } from '../db'
import { CommunicationTemplate } from '../db/schema/communication_template'
import { TemplateView } from '../lexicon/types/tools/ozone/communication/defs'

export type CommunicationTemplateServiceCreator = (
  db: Database,
) => CommunicationTemplateService

export class CommunicationTemplateService {
  constructor(public db: Database) {}

  static creator() {
    return (db: Database) => new CommunicationTemplateService(db)
  }

  async list(): Promise<Selectable<CommunicationTemplate>[]> {
    const list = await this.db.db
      .selectFrom('communication_template')
      .selectAll()
      .execute()

    return list
  }

  async create({
    name,
    contentMarkdown,
    subject,
    lang,
    disabled,
    updatedAt,
    createdAt,
    lastUpdatedBy,
  }: Omit<
    Selectable<CommunicationTemplate>,
    'id' | 'createdAt' | 'updatedAt'
  > & {
    createdAt?: Date
    updatedAt?: Date
  }): Promise<Selectable<CommunicationTemplate>> {
    const newTemplate = await this.db.db
      .insertInto('communication_template')
      .values({
        name,
        contentMarkdown,
        subject,
        lang,
        disabled,
        lastUpdatedBy,
        updatedAt: updatedAt || new Date(),
        createdAt: createdAt || new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return newTemplate
  }

  async update(
    id: number,
    {
      name,
      contentMarkdown,
      subject,
      disabled,
      lang,
      updatedAt,
      lastUpdatedBy,
    }: Partial<Omit<Selectable<CommunicationTemplate>, 'id' | 'createdAt'>>,
  ): Promise<Selectable<CommunicationTemplate>> {
    const updatedTemplate = await this.db.db
      .updateTable('communication_template')
      .where('id', '=', id)
      .set({
        name,
        contentMarkdown,
        subject,
        lang,
        disabled,
        lastUpdatedBy,
        updatedAt: updatedAt || new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return updatedTemplate
  }

  async delete(id: number): Promise<void> {
    await this.db.db
      .deleteFrom('communication_template')
      .where('id', '=', id)
      .execute()
  }

  view(template: Selectable<CommunicationTemplate>): TemplateView {
    return {
      id: `${template.id}`,
      name: template.name,
      contentMarkdown: template.contentMarkdown,
      disabled: template.disabled,
      lang: template.lang || undefined,
      subject: template.subject || undefined,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
      lastUpdatedBy: template.lastUpdatedBy,
    }
  }
}
