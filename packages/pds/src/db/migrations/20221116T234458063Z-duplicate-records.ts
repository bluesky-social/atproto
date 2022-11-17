import { Kysely } from 'kysely'

const duplicateRecordTable = 'duplicate_record'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable(duplicateRecordTable)
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('duplicateOf', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()

  await db.schema
    .createTable('repost_temp')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addColumn('subjectCid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addUniqueConstraint('repost_unique_subject', ['creator', 'subject'])
    .execute()
  await db
    .insertInto('repost_temp')
    .expression((exp) =>
      exp
        .selectFrom('repost')
        .selectAll()
        .where('uri', 'in', (qb) =>
          qb
            .selectFrom('repost')
            .select(db.fn.min('uri').as('uri'))
            .groupBy(['creator', 'subject']),
        ),
    )
    .execute()
  await db.schema.dropTable('repost').execute()
  await db.schema.alterTable('repost_temp').renameTo('repost').execute()

  await db.schema
    .createTable('trend_temp')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addColumn('subjectCid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addUniqueConstraint('trend_unique_subject', ['creator', 'subject'])
    .execute()
  await db
    .insertInto('trend_temp')
    .expression((exp) =>
      exp
        .selectFrom('trend')
        .selectAll()
        .where('uri', 'in', (qb) =>
          qb
            .selectFrom('trend')
            .select(db.fn.min('uri').as('uri'))
            .groupBy(['creator', 'subject']),
        ),
    )
    .execute()
  await db.schema.dropTable('trend').execute()
  await db.schema.alterTable('trend_temp').renameTo('trend').execute()

  await db.schema
    .createTable('vote_temp')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('direction', 'varchar', (col) => col.notNull())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addColumn('subjectCid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addUniqueConstraint('vote_unique_subject', ['creator', 'subject'])
    .execute()
  await db
    .insertInto('vote_temp')
    .expression((exp) =>
      exp
        .selectFrom('vote')
        .selectAll()
        .where('uri', 'in', (qb) =>
          qb
            .selectFrom('vote')
            .select(db.fn.min('uri').as('uri'))
            .groupBy(['creator', 'subject']),
        ),
    )
    .execute()
  await db.schema.dropTable('vote').execute()
  await db.schema.alterTable('vote_temp').renameTo('vote').execute()

  await db.schema
    .createTable('follow_temp')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('subjectDid', 'varchar', (col) => col.notNull())
    .addColumn('subjectDeclarationCid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addUniqueConstraint('follow_unique_subject', ['creator', 'subjectDid'])
    .execute()
  await db
    .insertInto('follow_temp')
    .expression((exp) =>
      exp
        .selectFrom('follow')
        .selectAll()
        .where('uri', 'in', (qb) =>
          qb
            .selectFrom('follow')
            .select(db.fn.min('uri').as('uri'))
            .groupBy(['creator', 'subjectDid']),
        ),
    )
    .execute()
  await db.schema.dropTable('follow').execute()
  await db.schema.alterTable('follow_temp').renameTo('follow').execute()

  await db.schema
    .createTable('assertion_temp')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('assertion', 'varchar', (col) => col.notNull())
    .addColumn('subjectDid', 'varchar', (col) => col.notNull())
    .addColumn('subjectDeclarationCid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addColumn('confirmUri', 'varchar')
    .addColumn('confirmCid', 'varchar')
    .addColumn('confirmCreated', 'varchar')
    .addColumn('confirmIndexed', 'varchar')
    .addUniqueConstraint('assertion_unique_subject', [
      'creator',
      'subjectDid',
      'assertion',
    ])
    .execute()
  await db
    .insertInto('assertion_temp')
    .expression((exp) =>
      exp
        .selectFrom('assertion')
        .selectAll()
        .where('uri', 'in', (qb) =>
          qb
            .selectFrom('assertion')
            .select(db.fn.min('uri').as('uri'))
            .groupBy(['creator', 'subjectDid', 'assertion']),
        ),
    )
    .execute()
  await db.schema.dropTable('assertion').execute()
  await db.schema.alterTable('assertion_temp').renameTo('assertion').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable(duplicateRecordTable)
}
