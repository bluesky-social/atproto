import { Kysely } from 'kysely'

const blobTable = 'blob'
const repoBlobTable = 'repo_blob'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable(blobTable)
    .addColumn('cid', 'varchar', (col) => col.primaryKey())
    .addColumn('mimeType', 'varchar', (col) => col.notNull())
    .addColumn('size', 'integer', (col) => col.notNull())
    .addColumn('tempKey', 'varchar')
    .addColumn('width', 'integer')
    .addColumn('height', 'integer')
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .execute()
  await db.schema
    .createTable(repoBlobTable)
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('recordUri', 'varchar', (col) => col.notNull())
    .addColumn('commit', 'varchar', (col) => col.notNull())
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint(`${repoBlobTable}_pkey`, ['cid', 'recordUri'])
    .execute()

  await db.schema
    .alterTable('profile')
    .addColumn('avatarCid', 'varchar')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('profile').dropColumn('avatarCid').execute()
  await db.schema.dropTable(repoBlobTable).execute()
  await db.schema.dropTable(blobTable).execute()
}
