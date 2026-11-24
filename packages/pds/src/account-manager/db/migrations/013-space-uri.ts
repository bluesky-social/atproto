import type { Kysely } from 'kysely'
import { rewriteSpaceUris } from '../../../db/rewrite-space-uris.js'

// Space URIs moved from `at://{spaceDid}/space/...` to `at:space/{spaceDid}/...`.
const COLUMNS = [
  ['space_notification_retry', 'space'],
  ['revoked_space_credential', 'space'],
  ['space_syncer_notification_retry', 'space'],
] as const

export async function up(db: Kysely<unknown>): Promise<void> {
  await rewriteSpaceUris(db, COLUMNS, 'up')
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await rewriteSpaceUris(db, COLUMNS, 'down')
}
