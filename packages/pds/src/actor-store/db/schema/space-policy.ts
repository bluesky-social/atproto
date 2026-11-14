import type { SpaceRefString } from '@atproto/syntax'
import type { JsonEncoded } from '../../../db/index.js'
import type { Policy } from '../../../space-policy/policy.js'

// The policy governing a space this account is the authority for. Only exists for
// spaces this account created: a member holds a repo in a space without being told
// its policy.
export interface SpacePolicy {
  uri: SpaceRefString
  // The policy object, e.g. com.atproto.memberspace.policy
  policyJson: JsonEncoded<Policy>
}

const tableName = 'space_policy'

export type PartialDB = { [tableName]: SpacePolicy }
