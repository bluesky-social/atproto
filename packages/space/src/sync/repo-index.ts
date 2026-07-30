import { decode, encode } from '@atproto/lex-cbor'
import { Cid, ifCid } from '@atproto/lex-data'
import { RepoVerificationError } from '../error.js'
import { formatRecordPath, parseRecordPath } from '../util.js'

/**
 * The index of a serialized repo: `"{collection}/{rkey}"` to the record's cid, in
 * the order record blocks follow it.
 *
 * Folding an index into a `RepoCommit` and comparing against a verified commit
 * authenticates every path/cid pair without reading a single record.
 */
export type RepoIndex = Map<string, Cid>

export type RepoIndexEntry = {
  collection: string
  rkey: string
  cid: Cid
}

export const repoIndex = (entries: Iterable<RepoIndexEntry>): RepoIndex => {
  const index: RepoIndex = new Map()
  for (const { collection, rkey, cid } of entries) {
    index.set(formatRecordPath(collection, rkey), cid)
  }
  return canonicalize(index)
}

export const repoIndexEntries = (index: RepoIndex): RepoIndexEntry[] =>
  [...index].map(([path, cid]) => ({ ...parseRecordPath(path), cid }))

export const encodeRepoIndex = (index: RepoIndex): Uint8Array =>
  encode(Object.fromEntries(index))

export const decodeRepoIndex = (bytes: Uint8Array): RepoIndex => {
  const decoded = decode(bytes)
  if (
    decoded === null ||
    typeof decoded !== 'object' ||
    Array.isArray(decoded)
  ) {
    throw new RepoVerificationError('Repo index must be a map')
  }

  const index: RepoIndex = new Map()
  for (const [path, value] of Object.entries(decoded)) {
    try {
      parseRecordPath(path)
    } catch {
      throw new RepoVerificationError(`Invalid path in repo index: ${path}`)
    }
    const cid = ifCid(value)
    if (!cid) {
      throw new RepoVerificationError(`Invalid cid in repo index at: ${path}`)
    }
    index.set(path, cid)
  }
  return canonicalize(index)
}

// Canonical DAG-CBOR key order: length first, then bytewise — not lexicographic.
// Sorting on construction means an index built from db rows iterates the same way
// as one decoded from a block, so provider and consumer always agree.
const canonicalize = (index: RepoIndex): RepoIndex => {
  const encoder = new TextEncoder()
  const keyed = [...index.keys()].map((path) => ({
    path,
    bytes: encoder.encode(path),
  }))
  keyed.sort((a, b) => {
    if (a.bytes.length !== b.bytes.length) {
      return a.bytes.length - b.bytes.length
    }
    for (let i = 0; i < a.bytes.length; i++) {
      if (a.bytes[i] !== b.bytes[i]) return a.bytes[i] - b.bytes[i]
    }
    return 0
  })
  return new Map(keyed.map(({ path }) => [path, index.get(path)!]))
}
