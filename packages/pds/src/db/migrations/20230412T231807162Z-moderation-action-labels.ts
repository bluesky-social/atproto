import { Kysely } from 'kysely'

const moderationActionTable = 'moderation_action'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable(moderationActionTable)
    .addColumn('createLabelVals', 'varchar')
    .execute()

  await db.schema
    .alterTable(moderationActionTable)
    .addColumn('negateLabelVals', 'varchar')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable(moderationActionTable)
    .dropColumn('createLabelVals')
    .execute()

  await db.schema
    .alterTable(moderationActionTable)
    .dropColumn('negateLabelVals')
    .execute()
}
