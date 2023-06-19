import { Kysely } from 'kysely'
import { Dialect } from '..'

export async function up(db: Kysely<unknown>, dialect: Dialect): Promise<void> {
  let builder = db.schema.createTable('user_pref')
  builder =
    dialect === 'pg'
      ? builder.addColumn('id', 'bigserial', (col) => col.primaryKey())
      : builder.addColumn('id', 'integer', (col) =>
          col.autoIncrement().primaryKey(),
        )
  await builder
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('valueJson', 'text', (col) => col.notNull())
    .execute()
  await db.schema
    .createIndex('user_pref_did_idx')
    .on('user_pref')
    .column('did')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('user_pref').execute()
}
