import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await Promise.all([
    db.schema
      .alterTable('moderation_action')
      .addColumn('actionDuration', 'varchar')
      .execute(),
    db.schema
      .alterTable('repo_root')
      .addColumn('takedownExpiresAt', 'varchar')
      .execute(),
    await db.schema
      .alterTable('record')
      .addColumn('takedownExpiresAt', 'varchar')
      .execute(),
  ])
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await Promise.all([
    db.schema.alterTable('repo_root').dropColumn('takedownExpiresAt').execute(),
    db.schema
      .alterTable('moderation_action')
      .dropColumn('actionDuration')
      .execute(),
    await db.schema
      .alterTable('record')
      .dropColumn('takedownExpiresAt')
      .execute(),
  ])
}
