import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('neuro_provision_nonce')
    .addColumn('nonce', 'varchar', (col) => col.primaryKey())
    .addColumn('legalId', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('expiresAt', 'varchar', (col) => col.notNull())
    .execute()

  // Index for cleanup queries
  await db.schema
    .createIndex('neuro_provision_nonce_expires_idx')
    .on('neuro_provision_nonce')
    .column('expiresAt')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('neuro_provision_nonce').execute()
}
