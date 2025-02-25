import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('label').addColumn('exp', 'varchar').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('label').dropColumn('exp').execute()
}
