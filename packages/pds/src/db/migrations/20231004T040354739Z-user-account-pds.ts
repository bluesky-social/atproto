import { Kysely } from 'kysely'
import { Dialect } from '..'

export async function up(db: Kysely<unknown>, dialect: Dialect): Promise<void> {
  const pdsBuilder =
    dialect === 'pg'
      ? db.schema
          .createTable('pds')
          .addColumn('id', 'serial', (col) => col.primaryKey())
      : db.schema
          .createTable('pds')
          .addColumn('id', 'integer', (col) => col.autoIncrement().primaryKey())
  await pdsBuilder
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('host', 'varchar', (col) => col.notNull())
    .execute()
  await db.schema
    .alterTable('user_account')
    .addColumn('pdsId', 'integer', (col) => col.references('pds.id'))
    .execute()
}
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('user_account').dropColumn('pdsId').execute()
  await db.schema.dropTable('pds').execute()
}
