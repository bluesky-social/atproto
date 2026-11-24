import type { Kysely } from 'kysely'
import { rewriteSpaceUris } from '../../../db/rewrite-space-uris.js'

// Space URIs moved from `at://{spaceDid}/space/...` to `at:space/{spaceDid}/...`.
// Record values are left as they are: their CIDs cover any space URIs inside.
const COLUMNS = [
  ['space', 'uri'],
  ['space_policy', 'uri'],
  ['memberspace_member', 'space'],
  ['space_record', 'uri'],
  ['space_record', 'space'],
  ['space_record_blob', 'recordUri'],
  ['space_repo', 'space'],
  ['space_record_oplog', 'space'],
  ['space_record_oplog', 'uri'],
  ['space_writer', 'space'],
  ['space_notify_registration', 'space'],
] as const

export async function up(db: Kysely<unknown>): Promise<void> {
  await rewriteSpaceUris(db, COLUMNS, 'up')
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await rewriteSpaceUris(db, COLUMNS, 'down')
}
