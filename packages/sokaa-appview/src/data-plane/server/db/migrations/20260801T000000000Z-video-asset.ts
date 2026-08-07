import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('video_asset')
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('videoCid', 'varchar', (col) => col.notNull())
    .addColumn('state', 'varchar', (col) => col.notNull())
    .addColumn('streamUid', 'varchar')
    .addColumn('playlistUrl', 'varchar')
    .addColumn('error', 'varchar')
    .addColumn('attempts', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('updatedAt', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('video_asset_pkey', ['did', 'videoCid'])
    .execute()
  await db.schema
    .createIndex('video_asset_state_idx')
    .on('video_asset')
    .column('state')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('video_asset').execute()
}
