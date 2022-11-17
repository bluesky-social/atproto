import { Kysely } from 'kysely'
import DatabaseSchema from '../database-schema'
import { Assertion } from '../tables/assertion'
import { Follow } from '../tables/follow'
import { Repost } from '../tables/repost'
import { Trend } from '../tables/trend'
import { Vote } from '../tables/vote'

type DatabaseSchemaWithTemps = DatabaseSchema & {
  repost_temp: Repost
  trend_temp: Trend
  vote_temp: Vote
  follow_temp: Follow
  assertion_temp: Assertion
}

const duplicateRecordTable = 'duplicate_record'

export async function up(db: Kysely<DatabaseSchemaWithTemps>): Promise<void> {
  await db.schema
    .createTable(duplicateRecordTable)
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('duplicateOf', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()

  await db.transaction().execute(async (tx) => {
    const dups = await tx
      .selectFrom('repost')
      .selectAll()
      .orderBy('repost.indexedAt', 'asc')
      .limit(1)
      .innerJoin('repost as copy', 'copy.subject', 'repost.subject')
      .where('copy.creator', '=', 'repost.creator')
      .where('copy.uri', '!=', 'repost.uri')
      .execute()
    const dupUris = dups.map((row) => row.uri)
    await tx.schema
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
    await tx
      .insertInto('repost_temp')
      .expression((exp) =>
        exp.selectFrom('repost').selectAll().where('uri', 'not in', dupUris),
      )
      .execute()
    await tx.schema.dropTable('repost').execute()
    await tx.schema.alterTable('repost_temp').renameTo('repost').execute()
  })

  await db.transaction().execute(async (tx) => {
    const dups = await tx
      .selectFrom('trend')
      .selectAll()
      .orderBy('trend.indexedAt', 'asc')
      .limit(1)
      .innerJoin('trend as copy', 'copy.subject', 'trend.subject')
      .where('copy.creator', '=', 'trend.creator')
      .where('copy.uri', '!=', 'trend.uri')
      .execute()
    const dupUris = dups.map((row) => row.uri)
    await tx.schema
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
    await tx
      .insertInto('trend_temp')
      .expression((exp) =>
        exp.selectFrom('trend').selectAll().where('uri', 'not in', dupUris),
      )
      .execute()
    await tx.schema.dropTable('trend').execute()
    await tx.schema.alterTable('trend_temp').renameTo('trend').execute()
  })

  await db.transaction().execute(async (tx) => {
    const dups = await tx
      .selectFrom('vote')
      .selectAll()
      .orderBy('vote.indexedAt', 'asc')
      .limit(1)
      .innerJoin('vote as copy', 'copy.subject', 'vote.subject')
      .where('copy.creator', '=', 'vote.creator')
      .where('copy.uri', '!=', 'vote.uri')
      .execute()
    const dupUris = dups.map((row) => row.uri)
    await tx.schema
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
    await tx
      .insertInto('vote_temp')
      .expression((exp) =>
        exp.selectFrom('vote').selectAll().where('uri', 'not in', dupUris),
      )
      .execute()
    await tx.schema.dropTable('vote').execute()
    await tx.schema.alterTable('vote_temp').renameTo('vote').execute()
  })

  await db.transaction().execute(async (tx) => {
    const dups = await tx
      .selectFrom('follow')
      .selectAll()
      .orderBy('follow.indexedAt', 'asc')
      .limit(1)
      .innerJoin('follow as copy', 'copy.subjectDid', 'follow.subjectDid')
      .where('copy.creator', '=', 'follow.creator')
      .where('copy.uri', '!=', 'follow.uri')
      .execute()
    const dupUris = dups.map((row) => row.uri)
    await tx.schema
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
    await tx
      .insertInto('follow_temp')
      .expression((exp) =>
        exp.selectFrom('follow').selectAll().where('uri', 'not in', dupUris),
      )
      .execute()
    await tx.schema.dropTable('follow').execute()
    await tx.schema.alterTable('follow_temp').renameTo('follow').execute()
  })

  await db.transaction().execute(async (tx) => {
    const dups = await tx
      .selectFrom('assertion')
      .selectAll()
      .orderBy('assertion.indexedAt', 'asc')
      .limit(1)
      .innerJoin('assertion as copy', 'copy.subjectDid', 'assertion.subjectDid')
      .where('copy.creator', '=', 'assertion.creator')
      .where('copy.assertion', '=', 'assertion.assertion')
      .where('copy.uri', '!=', 'assertion.uri')
      .execute()
    const dupUris = dups.map((row) => row.uri)
    await tx.schema
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
    await tx
      .insertInto('assertion_temp')
      .expression((exp) =>
        exp.selectFrom('assertion').selectAll().where('uri', 'not in', dupUris),
      )
      .execute()
    await tx.schema.dropTable('assertion').execute()
    await tx.schema.alterTable('assertion_temp').renameTo('assertion').execute()
  })
}

export async function down(db: Kysely<DatabaseSchema>): Promise<void> {
  await db.schema.dropTable(duplicateRecordTable)
}
