import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('actor')
    .addColumn('ageAssuranceAccess', 'text')
    .execute()
  await db.schema
    .alterTable('actor')
    .addColumn('ageAssuranceCountryCode', 'text')
    .execute()
  await db.schema
    .alterTable('actor')
    .addColumn('ageAssuranceRegionCode', 'text')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('actor').dropColumn('ageAssuranceAccess').execute()
  await db.schema
    .alterTable('actor')
    .dropColumn('ageAssuranceCountryCode')
    .execute()
  await db.schema
    .alterTable('actor')
    .dropColumn('ageAssuranceRegionCode')
    .execute()
}
