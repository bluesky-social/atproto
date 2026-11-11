import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // A registerNotify registration names a service rather than an endpoint, and
  // has no token, so it can't be carried over. Syncers re-register on their next
  // credential request.
  await db.schema.dropTable('space_credential_recipient').execute()

  // Endpoints registered (via getSpaceCredential) to receive notifications. A
  // registration is identified by its endpoint and token together.
  await db.schema
    .createTable('space_notify_registration')
    .addColumn('space', 'varchar', (col) => col.notNull())
    .addColumn('endpoint', 'varchar', (col) => col.notNull())
    .addColumn('token', 'varchar', (col) => col.notNull())
    .addColumn('expiresAt', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('space_notify_registration_pkey', [
      'space',
      'endpoint',
      'token',
    ])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('space_notify_registration').execute()
  await db.schema
    .createTable('space_credential_recipient')
    .addColumn('space', 'varchar', (col) => col.notNull())
    .addColumn('service', 'varchar', (col) => col.notNull())
    .addColumn('serviceEndpoint', 'varchar', (col) => col.notNull())
    .addColumn('expiresAt', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('space_credential_recipient_pkey', [
      'space',
      'service',
    ])
    .execute()
}
