import Database from '../db'
import { Selectable } from 'kysely'
import { CommunicationTemplate } from '../db/schema/communication_template'
import { CommunicationTemplateView } from '../lexicon/types/com/atproto/admin/defs'

export type CommunicationTemplateServiceCreator = (
  db: Database,
) => CommunicationTemplateService

export class CommunicationTemplateService {
  constructor(public db: Database) {}

  static creator() {
    return (db: Database) => new CommunicationTemplateService(db)
  }

  async create(
    template: Omit<Selectable<CommunicationTemplate>, 'id'>,
  ): Promise<Selectable<CommunicationTemplate>> {
    const newTemplate = await this.db.db
      .insertInto('communication_template')
      .values(template)
      .returningAll()
      .executeTakeFirstOrThrow()

    return newTemplate
  }

  async update(
    id: number,
    template: Partial<
      Omit<Selectable<CommunicationTemplate>, 'id' | 'createdAt'>
    >,
  ): Promise<Selectable<CommunicationTemplate>> {
    const updatedTemplate = await this.db.db
      .updateTable('communication_template')
      .where('id', '=', id)
      .set(template)
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

  view(template: Selectable<CommunicationTemplate>): CommunicationTemplateView {
    return {
      id: template.id,
      name: template.name,
      content: template.content,
      disabled: template.disabled,
      subject: template.subject || undefined,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
      lastUpdatedBy: template.lastUpdatedBy,
    }
  }
}
