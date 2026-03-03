import { Kysely } from 'kysely'

// Migration 014: Add jidRef column to neuro_identity_link.
//
// Background:
//   - `legalId`  = real legal identity (UUID@legal...), set by the webhook.
//   - `jid`      = XMPP JID for TEST USERS ONLY. Must never be used for auth
//                  of real users.
//   - `jidRef`   = XMPP JID for REAL users, used as a lookup key by the
//                  QuickLogin callback (which only receives the JID from Neuro,
//                  never the legalId). Stored by the webhook at provisioning
//                  time so the callback can resolve the correct row.
//
// This column separates the JID reference from the legalId, making it
// impossible to confuse a JID with a real legal identity in auth lookups.

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('neuro_identity_link')
    .addColumn('jidRef', 'varchar')
    .execute()

  await db.schema
    .createIndex('neuro_identity_link_jidRef_idx')
    .on('neuro_identity_link')
    .column('jidRef')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('neuro_identity_link_jidRef_idx').execute()

  await db.schema
    .alterTable('neuro_identity_link')
    .dropColumn('jidRef')
    .execute()
}
