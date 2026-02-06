import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // Neuro identity links table (ALWAYS REQUIRED)
  await db.schema
    .createTable('neuro_identity_link')
    .addColumn('neuroJid', 'varchar', (col) => col.primaryKey())
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('email', 'varchar')
    .addColumn('userName', 'varchar')
    .addColumn('linkedAt', 'varchar', (col) => col.notNull())
    .addColumn('lastLoginAt', 'varchar')
    .execute()

  await db.schema
    .createIndex('neuro_identity_link_did_idx')
    .on('neuro_identity_link')
    .column('did')
    .execute()

  // Pending sessions table (ONLY IF USING DATABASE STORAGE)
  await db.schema
    .createTable('neuro_pending_session')
    .addColumn('sessionId', 'varchar', (col) => col.primaryKey())
    .addColumn('serviceId', 'varchar', (col) => col.notNull())
    .addColumn('requestUri', 'varchar')
    .addColumn('deviceId', 'varchar')
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('expiresAt', 'varchar', (col) => col.notNull())
    .addColumn('completedAt', 'varchar')
    .addColumn('neuroJid', 'varchar')
    .execute()

  await db.schema
    .createIndex('neuro_pending_session_expires_idx')
    .on('neuro_pending_session')
    .column('expiresAt')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('neuro_identity_link').execute()
  await db.schema.dropTable('neuro_pending_session').execute()
}
