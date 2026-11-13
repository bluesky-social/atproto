import type { Kysely } from 'kysely'

// scope restrictions: when any is set, just the scoped content is muted;
// when none are set, the subject is fully muted
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('mute_op')
    .addColumn('onlyReposts', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .addColumn('onlyQuoteposts', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .execute()

  await db.schema
    .alterTable('mute_item')
    .addColumn('onlyReposts', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .addColumn('onlyQuoteposts', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('mute_item')
    .dropColumn('onlyReposts')
    .dropColumn('onlyQuoteposts')
    .execute()
  await db.schema
    .alterTable('mute_op')
    .dropColumn('onlyReposts')
    .dropColumn('onlyQuoteposts')
    .execute()
}
