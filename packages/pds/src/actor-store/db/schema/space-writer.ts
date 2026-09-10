// The writer set for a space, maintained by the authority from incoming
// notifyWrite calls. This is the sync boundary returned by listRepos — the set
// of accounts that have written to the space, with their latest known rev and
// commit hash. It is distinct from the member list (which is an access-control
// input).
export interface SpaceWriter {
  space: string
  did: string
  rev: string
  hash: Uint8Array
}

const tableName = 'space_writer'

export type PartialDB = { [tableName]: SpaceWriter }
