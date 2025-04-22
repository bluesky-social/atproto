import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('verification')
    .addColumn('uri', 'text', (col) => col.notNull().primaryKey())
    .addColumn('cid', 'text', (col) => col.notNull())
    .addColumn('issuer', 'text', (col) => col.notNull())
    .addColumn('subject', 'text', (col) => col.notNull())
    .addColumn('handle', 'text', (col) => col.notNull())
    .addColumn('displayName', 'text', (col) => col.notNull())
    .addColumn('revokeReason', 'text')
    .addColumn('revokedBy', 'text')
    .addColumn('revokedAt', 'text')
    .addColumn('createdAt', 'text', (col) => col.notNull())
    .addColumn('updatedAt', 'text', (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute()
  await db.schema
    .createIndex('verification_issuer_idx')
    .on('verification')
    .column('issuer')
    .execute()
  await db.schema
    .createIndex('verification_createdat_uri_idx')
    .on('verification')
    .columns(['createdAt', 'uri'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('verification').execute()
}
