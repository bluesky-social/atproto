import type { PolicyStateEntry } from '@atproto/space'
import { type DidString, isValidDid } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { com } from '../lexicons/index.js'
import { didToRecordKey, recordKeyToDid } from '../util/did-rkey.js'
import type { Policy } from './policy.js'

// A space host archive carries any state a policy keeps beyond the policy object
// itself. Of the baseline policies, only memberspace keeps any: its member list, one
// entry per member, keyed as the member's published record would be.

const { memberspace } = com.atproto

const MEMBER_KEY_PREFIX = `${memberspace.member.$type}/`

export type Member = {
  did: DidString
  access: { read: boolean; write: boolean }
}

export function memberStateEntry(member: Member): PolicyStateEntry {
  return {
    key: `${MEMBER_KEY_PREFIX}${didToRecordKey(member.did)}`,
    value: memberspace.member.$build(member.access),
  }
}

/**
 * Read the members out of an archive's policy state. A key the policy doesn't
 * define is refused rather than dropped, since dropping it would quietly change
 * who has access to the space.
 */
export function parsePolicyState(
  policy: Policy,
  entries: PolicyStateEntry[],
): Member[] {
  return entries.map(({ key, value }) => {
    const did = key.startsWith(MEMBER_KEY_PREFIX)
      ? recordKeyToDid(key.slice(MEMBER_KEY_PREFIX.length))
      : undefined
    if (!memberspace.policy.$isTypeOf(policy) || !isValidDid(did)) {
      throw new InvalidRequestError(`Unrecognized policy state: ${key}`)
    }
    const result = memberspace.member.$safeParse(value)
    if (!result.success) {
      throw new InvalidRequestError(
        `Invalid member at ${key}: ${result.reason.message}`,
      )
    }
    const { read, write } = result.value
    return { did, access: { read, write } }
  })
}
