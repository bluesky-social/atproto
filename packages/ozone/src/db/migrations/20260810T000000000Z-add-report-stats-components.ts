import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('report_stat')
    .addColumn('closedCount', 'integer')
    .addColumn('acknowledgedCount', 'integer')
    .addColumn('labelActionCount', 'integer')
    .addColumn('tagActionCount', 'integer')
    .addColumn('takedownActionCount', 'integer')
    .addColumn('ahtDurationSec', 'bigint')
    .addColumn('ahtSampleCount', 'integer')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('report_stat')
    .dropColumn('closedCount')
    .dropColumn('acknowledgedCount')
    .dropColumn('labelActionCount')
    .dropColumn('tagActionCount')
    .dropColumn('takedownActionCount')
    .dropColumn('ahtDurationSec')
    .dropColumn('ahtSampleCount')
    .execute()
}
