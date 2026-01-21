import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('actor')
    .addColumn('ageAssuranceStatus', 'text')
    .execute()

  await db.schema
    .alterTable('actor')
    .addColumn('ageAssuranceLastInitiatedAt', 'varchar')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('actor').dropColumn('ageAssuranceStatus').execute()

  await db.schema
    .alterTable('actor')
    .dropColumn('ageAssuranceLastInitiatedAt')
    .execute()
}
