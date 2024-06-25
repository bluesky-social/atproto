import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('authorization_request')
    .addColumn('id', 'varchar', (col) => col.primaryKey())
    .addColumn('did', 'varchar')
    .addColumn('deviceId', 'varchar')
    .addColumn('clientId', 'varchar', (col) => col.notNull())
    .addColumn('clientAuth', 'varchar', (col) => col.notNull())
    .addColumn('parameters', 'varchar', (col) => col.notNull())
    .addColumn('expiresAt', 'varchar', (col) => col.notNull())
    .addColumn('code', 'varchar')
    .execute()

  await db.schema
    .createIndex('authorization_request_code_idx')
    .unique()
    .on('authorization_request')
    // https://github.com/kysely-org/kysely/issues/302
    .expression(sql`code DESC) WHERE (code IS NOT NULL`)
    .execute()

  await db.schema
    .createIndex('authorization_request_expires_at_idx')
    .on('authorization_request')
    .column('expiresAt')
    .execute()

  await db.schema
    .createTable('device')
    .addColumn('id', 'varchar', (col) => col.primaryKey())
    .addColumn('sessionId', 'varchar', (col) => col.notNull())
    .addColumn('userAgent', 'varchar')
    .addColumn('ipAddress', 'varchar', (col) => col.notNull())
    .addColumn('lastSeenAt', 'varchar', (col) => col.notNull())
    .addUniqueConstraint('device_session_id_idx', ['sessionId'])
    .execute()

  await db.schema
    .createTable('device_account')
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('deviceId', 'varchar', (col) => col.notNull())
    .addColumn('authenticatedAt', 'varchar', (col) => col.notNull())
    .addColumn('remember', 'boolean', (col) => col.notNull())
    .addColumn('authorizedClients', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('device_account_pk', [
      'deviceId', // first because this table will be joined from the "device" table
      'did',
    ])
    .addForeignKeyConstraint(
      'device_account_device_id_fk',
      ['deviceId'],
      'device',
      ['id'],
      (qb) => qb.onDelete('cascade').onUpdate('cascade'),
    )
    .execute()

  await db.schema
    .createTable('token')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('tokenId', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('updatedAt', 'varchar', (col) => col.notNull())
    .addColumn('expiresAt', 'varchar', (col) => col.notNull())
    .addColumn('clientId', 'varchar', (col) => col.notNull())
    .addColumn('clientAuth', 'varchar', (col) => col.notNull())
    .addColumn('deviceId', 'varchar')
    .addColumn('parameters', 'varchar', (col) => col.notNull())
    .addColumn('details', 'varchar')
    .addColumn('code', 'varchar')
    .addColumn('currentRefreshToken', 'varchar')
    .addUniqueConstraint('token_current_refresh_token_unique_idx', [
      'currentRefreshToken',
    ])
    .addUniqueConstraint('token_id_unique_idx', ['tokenId'])
    .execute()

  await db.schema
    .createIndex('token_did_idx')
    .on('token')
    .column('did')
    .execute()

  await db.schema
    .createIndex('token_code_idx')
    .unique()
    .on('token')
    // https://github.com/kysely-org/kysely/issues/302
    .expression(sql`code DESC) WHERE (code IS NOT NULL`)
    .execute()

  await db.schema
    .createTable('used_refresh_token')
    .addColumn('refreshToken', 'varchar', (col) => col.primaryKey())
    .addColumn('tokenId', 'integer', (col) => col.notNull())
    .addForeignKeyConstraint(
      'used_refresh_token_fk',
      ['tokenId'],
      'token',
      ['id'],
      // uses "used_refresh_token_id_idx" index (when cascading)
      (qb) => qb.onDelete('cascade').onUpdate('cascade'),
    )
    .execute()

  await db.schema
    .createIndex('used_refresh_token_id_idx')
    .on('used_refresh_token')
    .column('tokenId')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('used_refresh_token').execute()
  await db.schema.dropTable('token').execute()
  await db.schema.dropTable('device_account').execute()
  await db.schema.dropTable('device').execute()
  await db.schema.dropTable('authorization_request').execute()
}
