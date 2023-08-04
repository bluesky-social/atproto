import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await Promise.all([
    db.schema
      .alterTable('moderation_action')
      .addColumn('actionDurationInHours', 'integer')
      .execute(),
    db.schema
      .alterTable('moderation_action')
      .addColumn('actionExpiresAt', 'varchar')
      .execute(),
  ])
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await Promise.all([
    db.schema
      .alterTable('moderation_action')
      .dropColumn('actionDurationInHours')
      .execute(),
    db.schema
      .alterTable('moderation_action')
      .dropColumn('actionExpiresAt')
      .execute(),
  ])
}
