import { Kysely, sql } from 'kysely'
import { Dialect } from '..'

export async function up(db: Kysely<any>, dialect: Dialect): Promise<void> {
  const binaryDatatype = dialect === 'sqlite' ? 'blob' : sql`bytea`

  await db.schema
    .createTable('ipld_block_temp')
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('size', 'integer', (col) => col.notNull())
    .addColumn('content', binaryDatatype, (col) => col.notNull())
    .addPrimaryKeyConstraint('ipld_block_with_creator_pkey', ['creator', 'cid'])
    .execute()

  await db
    .insertInto('ipld_block_temp')
    .columns(['cid', 'creator', 'size', 'content'])
    .expression((exp) =>
      exp
        .selectFrom('ipld_block')
        .innerJoin(
          'ipld_block_creator',
          'ipld_block_creator.cid',
          'ipld_block.cid',
        )
        .select([
          'ipld_block.cid',
          'ipld_block_creator.did',
          'ipld_block.size',
          'ipld_block.content',
        ]),
    )
    .execute()

  await db.schema.dropTable('ipld_block').execute()
  await db.schema.dropTable('ipld_block_creator').execute()
  await db.schema.alterTable('ipld_block_temp').renameTo('ipld_block').execute()
}

export async function down(db: Kysely<any>, dialect: Dialect): Promise<void> {
  const binaryDatatype = dialect === 'sqlite' ? 'blob' : sql`bytea`

  await db.schema
    .createTable('ipld_block_creator')
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint(`ipld_block_creator_pkey`, ['cid', 'did'])
    .execute()
  await db
    .insertInto('ipld_block_creator')
    .expression((exp) =>
      exp
        .selectFrom('ipld_block')
        .select(['ipld_block.cid as cid', 'ipld_block.creator as did']),
    )
    .execute()

  await db.schema
    .createTable('ipld_block_temp')
    .addColumn('cid', 'varchar', (col) => col.primaryKey())
    .addColumn('size', 'integer', (col) => col.notNull())
    .addColumn('content', binaryDatatype, (col) => col.notNull())
    .execute()

  await db
    .insertInto('ipld_block_temp')
    .expression((exp) =>
      exp
        .selectFrom('ipld_block')
        .select([
          'ipld_block.cid as cid',
          'ipld_block.size as size',
          'ipld_block.content as content',
        ])
        .distinct(),
    )
    .execute()

  await db.schema.dropTable('ipld_block').execute()
  await db.schema.alterTable('ipld_block_temp').renameTo('ipld_block').execute()
}
