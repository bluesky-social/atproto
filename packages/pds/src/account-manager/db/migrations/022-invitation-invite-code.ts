import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // Add atproto invite_code column for password-based invitation flow.
  // When set, the row represents a password-based invitation (not WID/QR).
  // The invite code is embedded in the onboarding URL and used to auto-verify
  // the account email at account creation time.
  await db.schema
    .alterTable('pending_invitations')
    .addColumn('invite_code', 'varchar')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('pending_invitations')
    .dropColumn('invite_code')
    .execute()
}
