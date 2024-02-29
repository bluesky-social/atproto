import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('label').addColumn('exp', 'varchar').execute()
  await db.schema.alterTable('label').addColumn('sig', 'varchar').execute()
  await db.schema
    .alterTable('label')
    .addColumn('signingKey', 'varchar')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('label').dropColumn('exp').execute()
  await db.schema.alterTable('label').dropColumn('sig').execute()
  await db.schema.alterTable('label').dropColumn('signingKey').execute()
}
