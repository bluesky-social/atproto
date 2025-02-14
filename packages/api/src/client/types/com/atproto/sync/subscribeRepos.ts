/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import { $Typed, is$typed as _is$typed, OmitKey } from '../../../../util'

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
  /** Indicates that this commit contained too many ops, or data size was too large. Consumers will need to make a separate request to get missing data. */
  tooBig: boolean
  /** The repo this event comes from. */
  repo: string
  /** Repo commit object CID. */
  commit: CID
  /** DEPRECATED -- unused. WARNING -- nullable and optional; stick with optional to ensure golang interoperability. */
  prev?: CID | null
  /** The rev of the emitted commit. Note that this information is also in the commit object included in blocks, unless this is a tooBig event. */
  rev: string
  /** The rev of the last emitted commit from this repo (if any). */
  since: string | null
  /** CAR file containing relevant blocks, as a diff since the previous repo state. */
  blocks: Uint8Array
  ops: RepoOp[]
  blobs: CID[]
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
  status?: 'takendown' | 'suspended' | 'deleted' | 'deactivated' | (string & {})
}

const hashAccount = 'account'

export function isAccount<V>(v: V) {
  return is$typed(v, id, hashAccount)
}

export function validateAccount<V>(v: V) {
  return validate<Account & V>(v, id, hashAccount)
}

/** DEPRECATED -- Use #identity event instead */
export interface Handle {
  $type?: 'com.atproto.sync.subscribeRepos#handle'
  seq: number
  did: string
  handle: string
  time: string
}

const hashHandle = 'handle'

export function isHandle<V>(v: V) {
  return is$typed(v, id, hashHandle)
}

export function validateHandle<V>(v: V) {
  return validate<Handle & V>(v, id, hashHandle)
}

/** DEPRECATED -- Use #account event instead */
export interface Migrate {
  $type?: 'com.atproto.sync.subscribeRepos#migrate'
  seq: number
  did: string
  migrateTo: string | null
  time: string
}

const hashMigrate = 'migrate'

export function isMigrate<V>(v: V) {
  return is$typed(v, id, hashMigrate)
}

export function validateMigrate<V>(v: V) {
  return validate<Migrate & V>(v, id, hashMigrate)
}

/** DEPRECATED -- Use #account event instead */
export interface Tombstone {
  $type?: 'com.atproto.sync.subscribeRepos#tombstone'
  seq: number
  did: string
  time: string
}

const hashTombstone = 'tombstone'

export function isTombstone<V>(v: V) {
  return is$typed(v, id, hashTombstone)
}

export function validateTombstone<V>(v: V) {
  return validate<Tombstone & V>(v, id, hashTombstone)
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
}

const hashRepoOp = 'repoOp'

export function isRepoOp<V>(v: V) {
  return is$typed(v, id, hashRepoOp)
}

export function validateRepoOp<V>(v: V) {
  return validate<RepoOp & V>(v, id, hashRepoOp)
}
