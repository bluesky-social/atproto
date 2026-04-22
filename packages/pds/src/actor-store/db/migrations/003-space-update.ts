import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // Alter space table: drop setHash and rev, add isMember
  await db.schema
    .alterTable('space')
    .dropColumn('setHash')
    .execute()

  await db.schema
    .alterTable('space')
    .dropColumn('rev')
    .execute()

  await db.schema
    .alterTable('space')
    .addColumn('isMember', 'integer', (col) => col.notNull().defaultTo(0))
    .execute()

  // Alter space_member table: add memberRev
  await db.schema
    .alterTable('space_member')
    .addColumn('memberRev', 'varchar', (col) => col.notNull().defaultTo(''))
    .execute()

  // Create space_repo table
  await db.schema
    .createTable('space_repo')
    .addColumn('space', 'varchar', (col) => col.primaryKey())
    .addColumn('setHash', 'blob')
    .addColumn('rev', 'varchar')
    .execute()

  // Create space_member_state table
  await db.schema
    .createTable('space_member_state')
    .addColumn('space', 'varchar', (col) => col.primaryKey())
    .addColumn('setHash', 'blob')
    .addColumn('rev', 'varchar')
    .execute()

  // Create space_record_oplog table
  await db.schema
    .createTable('space_record_oplog')
    .addColumn('space', 'varchar', (col) => col.notNull())
    .addColumn('rev', 'varchar', (col) => col.notNull())
    .addColumn('idx', 'integer', (col) => col.notNull())
    .addColumn('action', 'varchar', (col) => col.notNull())
    .addColumn('collection', 'varchar', (col) => col.notNull())
    .addColumn('rkey', 'varchar', (col) => col.notNull())
    .addColumn('cid', 'varchar')
    .addColumn('prev', 'varchar')
    .addPrimaryKeyConstraint('space_record_oplog_pkey', ['space', 'rev', 'idx'])
    .execute()

  // Create space_member_oplog table
  await db.schema
    .createTable('space_member_oplog')
    .addColumn('space', 'varchar', (col) => col.notNull())
    .addColumn('rev', 'varchar', (col) => col.notNull())
    .addColumn('idx', 'integer', (col) => col.notNull())
    .addColumn('action', 'varchar', (col) => col.notNull())
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('space_member_oplog_pkey', ['space', 'rev', 'idx'])
    .execute()

  // Create space_credential_recipient table
  await db.schema
    .createTable('space_credential_recipient')
    .addColumn('space', 'varchar', (col) => col.notNull())
    .addColumn('serviceDid', 'varchar', (col) => col.notNull())
    .addColumn('serviceEndpoint', 'varchar', (col) => col.notNull())
    .addColumn('lastIssuedAt', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('space_credential_recipient_pkey', ['space', 'serviceDid'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Drop new tables
  await db.schema.dropTable('space_credential_recipient').execute()
  await db.schema.dropTable('space_member_oplog').execute()
  await db.schema.dropTable('space_record_oplog').execute()
  await db.schema.dropTable('space_member_state').execute()
  await db.schema.dropTable('space_repo').execute()

  // Revert space_member table: drop memberRev
  await db.schema
    .alterTable('space_member')
    .dropColumn('memberRev')
    .execute()

  // Revert space table: drop isMember, add back setHash and rev
  await db.schema
    .alterTable('space')
    .dropColumn('isMember')
    .execute()

  await db.schema
    .alterTable('space')
    .addColumn('setHash', 'blob')
    .execute()

  await db.schema
    .alterTable('space')
    .addColumn('rev', 'varchar')
    .execute()
}
