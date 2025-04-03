import { Kysely, sql } from 'kysely'
import { HOUR } from '@atproto/common'
import {
  ClientId,
  DeviceAccountData,
  DeviceId,
  RequestId,
} from '@atproto/oauth-provider'
import { DateISO, JsonEncoded, toDateISO } from '../../../db'

export async function up(
  db: Kysely<{
    device_account: {
      did: string
      deviceId: DeviceId

      remember: 0 | 1
      authenticatedAt: string
      authorizedClients: JsonEncoded<ClientId[]>
    }
    account_device: {
      did: string
      deviceId: DeviceId

      createdAt: DateISO
      updatedAt: DateISO

      data: JsonEncoded<DeviceAccountData>
    }
    account_device_request: {
      did: string
      deviceId: DeviceId
      requestId: RequestId

      createdAt: DateISO
      updatedAt: DateISO

      data: JsonEncoded<DeviceAccountData>
    }
  }>,
): Promise<void> {
  // Security: Delete any leftover device accounts that are not remembered
  await db
    .deleteFrom('device_account')
    .where('remember', '=', 0)
    .where('authenticatedAt', '<', toDateISO(new Date(Date.now() - HOUR)))
    .execute()

  // replaces "device_account"
  await db.schema
    .createTable('account_device')
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('deviceId', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('updatedAt', 'varchar', (col) => col.notNull())
    .addColumn('data', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('account_device_pk', [
      'deviceId', // first because this table will be joined from the "device" table
      'did',
    ])
    .addForeignKeyConstraint(
      'account_device_did_fk',
      ['did'],
      'actor',
      ['did'],
      (qb) => qb.onDelete('cascade').onUpdate('cascade'),
    )
    .addForeignKeyConstraint(
      'account_device_device_id_fk',
      ['deviceId'],
      'device',
      ['id'],
      (qb) => qb.onDelete('cascade').onUpdate('cascade'),
    )
    .execute()

  // Migrate "device_account" to "account_device"
  await db
    .insertInto('account_device')
    .columns(['did', 'deviceId', 'createdAt', 'updatedAt', 'data'])
    .expression(
      db
        .selectFrom('device_account')
        .select('did')
        .select('deviceId')
        .select('authenticatedAt as createdAt') // Best we can do
        .select('authenticatedAt as updatedAt')
        .select(
          sql<JsonEncoded<DeviceAccountData>>`
            CASE remember
              WHEN 1 THEN '{"remember":true,"ephemeralCookie":null}'
              ELSE '{"remember":false,"ephemeralCookie":null}'
            END
          `.as('data'),
        )
        .where('remember', '=', 1),
    )
    .execute()

  // @NOTE No need to create an index on "deviceId" for "account_device" because
  // it is the first column in the primary key constraint

  await db.schema
    .createIndex('account_device_did_idx')
    .on('account_device')
    .column('did')
    .execute()

  await db.schema
    .createTable('account_device_request')
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('deviceId', 'varchar', (col) => col.notNull())
    .addColumn('requestId', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('updatedAt', 'varchar', (col) => col.notNull())
    .addColumn('data', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('account_device_request_pk', [
      // first because this table will be joined from the "device" table
      'deviceId',
      // second to be able to query by ["deviceId", "did"]
      'did',
      // last because covered by its own index when querying by requestId
      'requestId',
    ])
    .addForeignKeyConstraint(
      'account_device_request_did_fk',
      ['did'],
      'actor',
      ['did'],
      (qb) => qb.onDelete('cascade').onUpdate('cascade'),
    )
    .addForeignKeyConstraint(
      'account_device_request_device_id_fk',
      ['deviceId'],
      'device',
      ['id'],
      (qb) => qb.onDelete('cascade').onUpdate('cascade'),
    )
    .addForeignKeyConstraint(
      'account_device_request_request_id_fk',
      ['requestId'],
      'authorization_request',
      ['id'],
      (qb) => qb.onDelete('cascade').onUpdate('cascade'),
    )
    .execute()

  // @NOTE No need to create an index on "deviceId" for "account_device_request"
  // because it is the first column in the primary key constraint

  // @NOTE No need to create an index on "did" for "account_device_request"
  // because queries will always either specify the "deviceId" (covered by the
  // pk) or the "requestId" (covered by "account_device_request_request_id_idx")

  await db.schema
    .createIndex('account_device_request_request_id_idx')
    .on('account_device_request')
    .column('requestId')
    .execute()

  await db.schema
    .createTable('authorized_client')
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('clientId', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('updatedAt', 'varchar', (col) => col.notNull())
    .addColumn('data', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('authorized_client_pk', ['did', 'clientId'])
    .addForeignKeyConstraint(
      'authorized_client_did_fk',
      ['did'],
      'actor',
      ['did'],
      (qb) => qb.onDelete('cascade').onUpdate('cascade'),
    )
    .execute()

  await db.schema
    .createIndex('authorized_client_did_idx')
    .on('authorized_client')
    .column('did')
    .execute()

  // We don't migrate the "device_account" authorized clients. Users will need
  // to reauthorize the client during the next oauth flow (minor inconvenience
  // for authenticated clients users).
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('authorized_client').execute()
  await db.schema.dropTable('account_device_request').execute()
  await db.schema.dropTable('account_device').execute()
}
