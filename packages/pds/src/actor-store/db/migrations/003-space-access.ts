import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('simplespace_config')
    .addColumn('readPolicy', 'varchar', (col) =>
      col.notNull().defaultTo('member-list'),
    )
    .execute()
  await db.schema
    .alterTable('simplespace_config')
    .addColumn('readManagingApp', 'varchar')
    .execute()
  await db.schema
    .alterTable('simplespace_config')
    .addColumn('writePolicy', 'varchar', (col) =>
      col.notNull().defaultTo('member-list'),
    )
    .execute()
  await db.schema
    .alterTable('simplespace_config')
    .addColumn('writeManagingApp', 'varchar')
    .execute()
  await sql`
    update simplespace_config
    set readPolicy = policy,
        readManagingApp = managingApp,
        writePolicy = policy,
        writeManagingApp = managingApp
  `.execute(db)
  await db.schema
    .alterTable('simplespace_config')
    .dropColumn('policy')
    .execute()
  await db.schema
    .alterTable('simplespace_config')
    .dropColumn('managingApp')
    .execute()

  await db.schema
    .alterTable('simplespace_member')
    .addColumn('read', 'integer', (col) => col.notNull().defaultTo(1))
    .execute()
  await db.schema
    .alterTable('simplespace_member')
    .addColumn('write', 'integer', (col) => col.notNull().defaultTo(1))
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('simplespace_member').dropColumn('read').execute()
  await db.schema.alterTable('simplespace_member').dropColumn('write').execute()

  await db.schema
    .alterTable('simplespace_config')
    .addColumn('policy', 'varchar', (col) =>
      col.notNull().defaultTo('member-list'),
    )
    .execute()
  await db.schema
    .alterTable('simplespace_config')
    .addColumn('managingApp', 'varchar')
    .execute()
  await sql`
    update simplespace_config
    set policy = readPolicy,
        managingApp = readManagingApp
  `.execute(db)
  await db.schema
    .alterTable('simplespace_config')
    .dropColumn('readPolicy')
    .execute()
  await db.schema
    .alterTable('simplespace_config')
    .dropColumn('readManagingApp')
    .execute()
  await db.schema
    .alterTable('simplespace_config')
    .dropColumn('writePolicy')
    .execute()
  await db.schema
    .alterTable('simplespace_config')
    .dropColumn('writeManagingApp')
    .execute()
}
