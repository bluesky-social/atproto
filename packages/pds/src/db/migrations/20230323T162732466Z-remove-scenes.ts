import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('scene').execute()
  await db.schema.dropTable('trend').execute()
  await db.schema.dropTable('scene_member_count').execute()
  await db.schema.dropTable('scene_votes_on_post').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('scene')
    .addColumn('handle', 'varchar', (col) => col.primaryKey())
    .addColumn('owner', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .execute()

  await db.schema
    .createTable('trend')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addColumn('subjectCid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()

  await db.schema
    .createTable('scene_member_count')
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('count', 'integer', (col) => col.notNull())
    .execute()
  await db.schema
    .createTable('scene_votes_on_post')
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addColumn('count', 'integer', (col) => col.notNull())
    .addColumn('postedTrending', 'int2', (col) => col.notNull())
    .addPrimaryKeyConstraint(`scene_votes_on_post_pkey`, ['did', 'subject'])
    .execute()
}
