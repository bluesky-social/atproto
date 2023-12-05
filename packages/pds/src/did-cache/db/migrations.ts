import { Kysely } from 'kysely'

export default {
  '001': {
    up: async (db: Kysely<unknown>) => {
      await db.schema
        .createTable('did_doc')
        .addColumn('did', 'varchar', (col) => col.primaryKey())
        .addColumn('doc', 'text', (col) => col.notNull())
        .addColumn('updatedAt', 'bigint', (col) => col.notNull())
        .execute()
    },
    down: async (db: Kysely<unknown>) => {
      await db.schema.dropTable('did_doc').execute()
    },
  },
}
