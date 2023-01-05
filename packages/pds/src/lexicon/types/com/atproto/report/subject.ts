/**
 * GENERATED CODE - DO NOT MODIFY
 */
export interface Repo {
  /** The DID of the repo. */
  did: string
  [k: string]: unknown
}

export interface Record {
  /** The DID of the repo. */
  did: string
  /** The NSID of the collection. */
  collection: string
  /** The key of the record. */
  rkey: string
  /** The CID of the version of the record. If not specified, defaults to the most recent version. */
  cid?: string
  [k: string]: unknown
}

export interface RecordRef {
  uri: string
  cid: string
  [k: string]: unknown
}
