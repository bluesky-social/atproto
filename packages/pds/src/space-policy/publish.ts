import type { LexMap } from '@atproto/lex-data'
import type {
  DidString,
  NsidString,
  RecordKeyString,
  SpaceRefString,
} from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import type { SpaceTransactor } from '../actor-store/space/transactor.js'
import { toSpaceRef } from '../api/com/atproto/space/util.js'
import { com } from '../lexicons/index.js'
import {
  type PreparedWrite,
  prepareCreate,
  prepareDelete,
  prepareUpdate,
  spaceRecordUri,
} from '../repo/index.js'
import {
  type Policy,
  areMembersPublished,
  isPolicyPublished,
} from './policy.js'

// A policy can ask for the space's policy and member list to be published to
// readers, as records in the authority's own repo in the space. The policy and
// member list remain the source of truth, and the PDS keeps these records in sync
// with them.

const POLICY_COLLECTION = com.atproto.space.policy.$type
const POLICY_RKEY = 'self'
const MEMBER_COLLECTION = com.atproto.memberspace.member.$type

/** Writing one of these records directly is refused in any repo. */
export function assertNotPublishedRecord(collection: string): void {
  if (collection === POLICY_COLLECTION || collection === MEMBER_COLLECTION) {
    throw new InvalidRequestError(
      `${collection} records are published by the PDS from a space's configuration and cannot be written directly`,
    )
  }
}

/** Publish, update, or withdraw the policy record to match the policy. */
export async function preparePolicyRecordWrites(
  txn: SpaceTransactor,
  space: SpaceRefString,
  policy: Policy,
): Promise<PreparedWrite[]> {
  if (isPolicyPublished(policy)) {
    const record = com.atproto.space.policy.$build({ policy })
    return [
      await preparePut(txn, space, POLICY_COLLECTION, POLICY_RKEY, record),
    ]
  }
  return prepareDeleteIfExists(txn, space, POLICY_COLLECTION, POLICY_RKEY)
}

/**
 * Publish, update, or withdraw a member's record to match their entry in the
 * member list. `access` is omitted for a DID that is no longer a member.
 */
export async function prepareMemberRecordWrites(
  txn: SpaceTransactor,
  space: SpaceRefString,
  policy: Policy,
  did: DidString,
  access?: { read: boolean; write: boolean },
): Promise<PreparedWrite[]> {
  const rkey = memberRecordKey(did)
  if (access && areMembersPublished(policy)) {
    const record = com.atproto.memberspace.member.$build(access)
    return [await preparePut(txn, space, MEMBER_COLLECTION, rkey, record)]
  }
  return prepareDeleteIfExists(txn, space, MEMBER_COLLECTION, rkey)
}

// A record key can't contain `%`, so the percent-encoded port of a localhost
// did:web is left unencoded: did:web:localhost%3A2583 -> did:web:localhost:2583
// @TODO a stopgap until Lexicon has a record key format for DIDs
function memberRecordKey(did: DidString): RecordKeyString {
  return did.replace('%3A', ':')
}

/** Publish or withdraw the whole member list to match the policy. */
export async function prepareMemberListWrites(
  txn: SpaceTransactor,
  space: SpaceRefString,
  policy: Policy,
): Promise<PreparedWrite[]> {
  const writes: PreparedWrite[] = []
  for (const member of await txn.listMembers(space)) {
    const access = { read: !!member.read, write: !!member.write }
    const memberWrites = await prepareMemberRecordWrites(
      txn,
      space,
      policy,
      member.did as DidString,
      access,
    )
    writes.push(...memberWrites)
  }
  return writes
}

async function preparePut(
  txn: SpaceTransactor,
  space: SpaceRefString,
  collection: NsidString,
  rkey: RecordKeyString,
  record: LexMap,
): Promise<PreparedWrite> {
  const did = toSpaceRef(space).spaceDid
  const uri = spaceRecordUri(space, did, collection, rkey)
  const exists = await txn.hasRecord(uri.toString())
  const write = { did, space, collection, rkey, record }
  return exists ? prepareUpdate(write) : prepareCreate(write)
}

async function prepareDeleteIfExists(
  txn: SpaceTransactor,
  space: SpaceRefString,
  collection: NsidString,
  rkey: RecordKeyString,
): Promise<PreparedWrite[]> {
  const did = toSpaceRef(space).spaceDid
  const uri = spaceRecordUri(space, did, collection, rkey)
  const exists = await txn.hasRecord(uri.toString())
  if (!exists) return []
  return [prepareDelete({ did, space, collection, rkey })]
}
