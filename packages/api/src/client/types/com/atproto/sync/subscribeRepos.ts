/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'com.atproto.sync.subscribeRepos'

/** Represents an update of repository state. Note that empty commits are allowed, which include no repo data changes, but an update to rev and signature. */
export interface Commit {
  $type?: 'com.atproto.sync.subscribeRepos#commit'
  /** The stream sequence number of this message. */
  seq: number
  /** DEPRECATED -- unused */
  rebase: boolean
  /** DEPRECATED -- replaced by #sync event and data limits. Indicates that this commit contained too many ops, or data size was too large. Consumers will need to make a separate request to get missing data. */
  tooBig: boolean
  /** The repo this event comes from. Note that all other message types name this field 'did'. */
  repo: string
  /** Repo commit object CID. */
  commit: CID
  /** The rev of the emitted commit. Note that this information is also in the commit object included in blocks, unless this is a tooBig event. */
  rev: string
  /** The rev of the last emitted commit from this repo (if any). */
  since: string | null
  /** CAR file containing relevant blocks, as a diff since the previous repo state. The commit must be included as a block, and the commit block CID must be the first entry in the CAR header 'roots' list. */
  blocks: Uint8Array
  ops: RepoOp[]
  blobs: CID[]
  /** The root CID of the MST tree for the previous commit from this repo (indicated by the 'since' revision field in this message). Corresponds to the 'data' field in the repo commit object. NOTE: this field is effectively required for the 'inductive' version of firehose. */
  prevData?: CID
  /** Timestamp of when this message was originally broadcast. */
  time: string
}

const hashCommit = 'commit'

export function isCommit<V>(v: V) {
  return is$typed(v, id, hashCommit)
}

export function validateCommit<V>(v: V) {
  return validate<Commit & V>(v, id, hashCommit)
}

/** Updates the repo to a new state, without necessarily including that state on the firehose. Used to recover from broken commit streams, data loss incidents, or in situations where upstream host does not know recent state of the repository. */
export interface Sync {
  $type?: 'com.atproto.sync.subscribeRepos#sync'
  /** The stream sequence number of this message. */
  seq: number
  /** The account this repo event corresponds to. Must match that in the commit object. */
  did: string
  /** CAR file containing the commit, as a block. The CAR header must include the commit block CID as the first 'root'. */
  blocks: Uint8Array
  /** The rev of the commit. This value must match that in the commit object. */
  rev: string
  /** Timestamp of when this message was originally broadcast. */
  time: string
}

const hashSync = 'sync'

export function isSync<V>(v: V) {
  return is$typed(v, id, hashSync)
}

export function validateSync<V>(v: V) {
  return validate<Sync & V>(v, id, hashSync)
}

/** Represents a change to an account's identity. Could be an updated handle, signing key, or pds hosting endpoint. Serves as a prod to all downstream services to refresh their identity cache. */
export interface Identity {
  $type?: 'com.atproto.sync.subscribeRepos#identity'
  seq: number
  did: string
  time: string
  /** The current handle for the account, or 'handle.invalid' if validation fails. This field is optional, might have been validated or passed-through from an upstream source. Semantics and behaviors for PDS vs Relay may evolve in the future; see atproto specs for more details. */
  handle?: string
}

const hashIdentity = 'identity'

export function isIdentity<V>(v: V) {
  return is$typed(v, id, hashIdentity)
}

export function validateIdentity<V>(v: V) {
  return validate<Identity & V>(v, id, hashIdentity)
}

/** Represents a change to an account's status on a host (eg, PDS or Relay). The semantics of this event are that the status is at the host which emitted the event, not necessarily that at the currently active PDS. Eg, a Relay takedown would emit a takedown with active=false, even if the PDS is still active. */
export interface Account {
  $type?: 'com.atproto.sync.subscribeRepos#account'
  seq: number
  did: string
  time: string
  /** Indicates that the account has a repository which can be fetched from the host that emitted this event. */
  active: boolean
  /** If active=false, this optional field indicates a reason for why the account is not active. */
  status?:
    | 'takendown'
    | 'suspended'
    | 'deleted'
    | 'deactivated'
    | 'desynchronized'
    | 'throttled'
    | (string & {})
}

const hashAccount = 'account'

export function isAccount<V>(v: V) {
  return is$typed(v, id, hashAccount)
}

export function validateAccount<V>(v: V) {
  return validate<Account & V>(v, id, hashAccount)
}

export interface Info {
  $type?: 'com.atproto.sync.subscribeRepos#info'
  name: 'OutdatedCursor' | (string & {})
  message?: string
}

const hashInfo = 'info'

export function isInfo<V>(v: V) {
  return is$typed(v, id, hashInfo)
}

export function validateInfo<V>(v: V) {
  return validate<Info & V>(v, id, hashInfo)
}

/** A repo operation, ie a mutation of a single record. */
export interface RepoOp {
  $type?: 'com.atproto.sync.subscribeRepos#repoOp'
  action: 'create' | 'update' | 'delete' | (string & {})
  path: string
  /** For creates and updates, the new record CID. For deletions, null. */
  cid: CID | null
  /** For updates and deletes, the previous record CID (required for inductive firehose). For creations, field should not be defined. */
  prev?: CID
}

const hashRepoOp = 'repoOp'

export function isRepoOp<V>(v: V) {
  return is$typed(v, id, hashRepoOp)
}

export function validateRepoOp<V>(v: V) {
  return validate<RepoOp & V>(v, id, hashRepoOp)
}
