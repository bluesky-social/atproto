// The policy governing a space this account is the authority for. Only exists for
// spaces this account created: a member holds a repo in a space without being told
// its policy.
export interface SpacePolicy {
  uri: string
  policyJson: string // json, the policy object (e.g. com.atproto.memberspace.policy)
}

const tableName = 'space_policy'

export type PartialDB = { [tableName]: SpacePolicy }
