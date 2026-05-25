import { Kysely } from 'kysely'

// Migration 023: Persist the WID login JID on each refresh token row so that
// token rotation can re-embed it in the new access JWT.
//
// Background: the `jid` claim in an access JWT identifies the WID session that
// initiated the login. `getLinkedAccounts` reads this claim to look up all
// DIDs linked to the same JID and issue them sessions, powering the account
// switcher. Previously, `rotateRefreshToken` created new tokens without the
// `jid` (it had no way to recover it) so every rotation silently stripped the
// WID context — causing the account switcher to disappear after 120 minutes.
//
// Fix: store the originating JID on the refresh_token row (nullable — password
// and OAuth logins never have a JID). Rotation reads `loginJid` from the old
// row and forwards it to `createTokens`, preserving the WID context for the
// full lifetime of the token chain.

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('refresh_token')
    .addColumn('loginJid', 'varchar')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('refresh_token')
    .dropColumn('loginJid')
    .execute()
}
