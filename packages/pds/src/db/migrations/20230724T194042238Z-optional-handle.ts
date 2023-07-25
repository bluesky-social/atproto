import { Kysely, sql } from 'kysely'
import { Dialect } from '..'

export async function up(db: Kysely<unknown>, dialect: Dialect): Promise<void> {
  if (dialect !== 'sqlite') {
    await db.schema
      .alterTable('did_handle')
      .alterColumn('handle')
      .dropNotNull()
      .execute()
  } else {
    await db.schema.dropTable('did_handle').execute()
    await db.schema
      .createTable('did_handle')
      .addColumn('did', 'varchar', (col) => col.primaryKey())
      .addColumn('handle', 'varchar')
      .execute()
    await db.schema
      .createIndex('did_handle_handle_lower_idx')
      .unique()
      .on('did_handle')
      .expression(sql`lower("handle")`)
      .execute()
  }
}

export async function down(
  db: Kysely<unknown>,
  dialect: Dialect,
): Promise<void> {
  if (dialect !== 'sqlite') {
    await db.schema
      .alterTable('did_handle')
      .alterColumn('handle')
      .setNotNull()
      .execute()
  } else {
    await db.schema.dropTable('did_handle').execute()
    await db.schema
      .createTable('did_handle')
      .addColumn('did', 'varchar', (col) => col.primaryKey())
      .addColumn('handle', 'varchar', (col) => col.notNull())
      .execute()
    await db.schema
      .createIndex('did_handle_handle_lower_idx')
      .unique()
      .on('did_handle')
      .expression(sql`lower("handle")`)
      .execute()
  }
}
