import { type Kysely, sql } from 'kysely'

// Alpha only: brings alpha DBs to the space data model that permissioned-data
// squashes into its 002-spaces. Unlike other migrations it drops columns, so an
// older alpha release can't write spaces once this has run.
export async function up(db: Kysely<unknown>): Promise<void> {
  // A filter by authority is a range of the uri primary key instead.
  await db.schema.alterTable('space').dropColumn('authority').execute()

  // Serves listSpaces filtered by type. Partial, matching listSpaces' deletedAt
  // filter.
  await db.schema
    .createIndex('space_type_idx')
    .on('space')
    .columns(['type', 'uri'])
    .where(sql.ref('deletedAt'), 'is', null)
    .execute()

  // Paging a space's records goes through the uri primary key instead.
  await db.schema.dropIndex('space_record_rev_idx').execute()

  // An op joins to its record by (space, collection, rkey), and its action
  // follows from cid and prev.
  await db.schema
    .alterTable('space_record_oplog')
    .dropColumn('action')
    .execute()
  await db.schema.alterTable('space_record_oplog').dropColumn('uri').execute()
}

// The dropped columns were all derived, so they're restored from their sources.
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('space_record_oplog')
    .addColumn('uri', 'varchar', (col) => col.notNull().defaultTo(''))
    .execute()
  await db.schema
    .alterTable('space_record_oplog')
    .addColumn('action', 'varchar', (col) => col.notNull().defaultTo(''))
    .execute()
  await sql`
    update space_record_oplog set
      uri = space || '/' || (select did from repo_root) || '/' || collection || '/' || rkey,
      action = case
        when cid is null then 'delete'
        when prev is null then 'create'
        else 'update'
      end
  `.execute(db)

  await db.schema
    .createIndex('space_record_rev_idx')
    .on('space_record')
    .columns(['space', 'repoRev'])
    .execute()

  await db.schema.dropIndex('space_type_idx').execute()

  // A space uri is `at://{authority}/space/{type}/{skey}`.
  await db.schema
    .alterTable('space')
    .addColumn('authority', 'varchar', (col) => col.notNull().defaultTo(''))
    .execute()
  await sql`
    update space set authority = substr(uri, 6, instr(substr(uri, 6), '/') - 1)
  `.execute(db)
}
