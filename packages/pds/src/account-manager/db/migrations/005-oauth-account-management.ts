import { Kysely } from 'kysely'
import { HOUR } from '@atproto/common'
import { ClientId, DeviceId } from '@atproto/oauth-provider'
import { DateISO, JsonEncoded, toDateISO } from '../../../db'

// @NOTE this migration has been updated to be idempotent through
// the insertInto('account_device') step. this allows users to roll
// forward if the migration partially succeeded on first run, failing
// on a fk constraint during the insertInto('account_device') step.
// this previously occurred under the following conditions:
//  a. a user was deleted
//  b. this user used oauth functionality with "remember me" selected.

export async function up(
  db: Kysely<{
    account: {
      did: string
    }
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
    }
  }>,
): Promise<void> {
  // Security: Delete any leftover device accounts that are not remembered
  // @NOTE idempotent, see note at top of migration.
  await db
    .deleteFrom('device_account')
    .where('remember', '=', 0)
    .where('authenticatedAt', '<', toDateISO(new Date(Date.now() - HOUR)))
    .execute()

  // replaces "device_account"
  // @NOTE idempotent from ifNotExists(), see note at top of migration.
  await db.schema
    .createTable('account_device')
    .ifNotExists()
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('deviceId', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('updatedAt', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('account_device_pk', [
      'deviceId', // first because this table will be joined from the "device" table
      'did',
    ])
    .addForeignKeyConstraint(
      'account_device_did_fk',
      ['did'],
      'account',
      ['did'],
      // cascade on delete, future-proofing on update (fk can't be altered)
      (qb) => qb.onDelete('cascade').onUpdate('cascade'),
    )
    .addForeignKeyConstraint(
      'account_device_device_id_fk',
      ['deviceId'],
      'device',
      ['id'],
      // cascade on delete, future-proofing on update (fk can't be altered)
      (qb) => qb.onDelete('cascade').onUpdate('cascade'),
    )
    .execute()

  // Migrate "device_account" to "account_device"
  // @NOTE idempotent from onConflict(): see note at top of migration.
  await db
    .insertInto('account_device')
    .columns(['did', 'deviceId', 'createdAt', 'updatedAt'])
    .expression(
      db
        .selectFrom('device_account')
        .select('did')
        .select('deviceId')
        .select('authenticatedAt as createdAt') // Best we can do
        .select('authenticatedAt as updatedAt')
        .where('remember', '=', 1)
        .whereExists((qb) =>
          // device_account does not have fkey on account.did,
          // so we satisfy account_device_did_fk with this condition.
          qb
            .selectFrom('account')
            .selectAll()
            .whereRef('account.did', '=', 'device_account.did'),
        ),
    )
    .onConflict((oc) => oc.doNothing())
    .execute()

  // @NOTE No need to create an index on "deviceId" for "account_device" because
  // it is the first column in the primary key constraint

  await db.schema
    .createIndex('account_device_did_idx')
    .on('account_device')
    .column('did')
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
      'account',
      ['did'],
      // cascade on delete, future-proofing on update (fk can't be altered)
      (qb) => qb.onDelete('cascade').onUpdate('cascade'),
    )
    .execute()

  // We don't migrate the "device_account" authorized clients. Users will need
  // to reauthorize the client during the next oauth flow (minor inconvenience
  // for authenticated clients users).
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('authorized_client').execute()
  await db.schema.dropTable('account_device').execute()
}
