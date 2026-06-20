import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // poll topic records
  await db.schema
    .createTable('poll')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('endsAt', 'varchar')
    .addColumn('endedNotifiedAt', 'varchar')
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addColumn('sortAt', 'varchar', (col) =>
      col
        .generatedAlwaysAs(sql`least("createdAt", "indexedAt")`)
        .stored()
        .notNull(),
    )
    .execute()

  await db.schema
    .createIndex('poll_creator_idx')
    .on('poll')
    .column('creator')
    .execute()

  // index for the poll-closer sweep: find ended, not-yet-notified polls
  await db.schema
    .createIndex('poll_pending_close_idx')
    .on('poll')
    .columns(['endsAt'])
    .where(sql.ref('endedNotifiedAt'), 'is', null)
    .execute()

  // poll vote records
  await db.schema
    .createTable('poll_vote')
    .addColumn('uri', 'varchar', (col) => col.notNull())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addColumn('subjectCid', 'varchar', (col) => col.notNull())
    .addColumn('option', 'integer', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addColumn('sortAt', 'varchar', (col) =>
      col
        .generatedAlwaysAs(sql`least("createdAt", "indexedAt")`)
        .stored()
        .notNull(),
    )
    // one counted vote per user per poll
    .addPrimaryKeyConstraint('poll_vote_pkey', ['creator', 'subject'])
    .execute()

  await db.schema
    .createIndex('poll_vote_uri_idx')
    .on('poll_vote')
    .column('uri')
    .execute()

  // ordering for the voter list + per-option facepiles
  await db.schema
    .createIndex('poll_vote_subject_option_sortat_idx')
    .on('poll_vote')
    .columns(['subject', 'option', 'sortAt', 'cid'])
    .execute()

  // denormalized per-option vote counts
  await db.schema
    .createTable('poll_option_agg')
    .addColumn('pollUri', 'varchar', (col) => col.notNull())
    .addColumn('option', 'integer', (col) => col.notNull())
    .addColumn('voteCount', 'integer', (col) => col.notNull().defaultTo(0))
    .addPrimaryKeyConstraint('poll_option_agg_pkey', ['pollUri', 'option'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('poll_option_agg').execute()
  await db.schema.dropTable('poll_vote').execute()
  await db.schema.dropTable('poll').execute()
}
