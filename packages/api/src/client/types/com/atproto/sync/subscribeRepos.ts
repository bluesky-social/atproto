/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'

const id = 'com.atproto.sync.subscribeRepos'

/** Represents an update of repository state. Note that empty commits are allowed, which include no repo data changes, but an update to rev and signature. */
export interface Commit {
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
  [k: string]: unknown
}

export function isCommit(
  v: unknown,
): v is Commit & { $type: $Type<'com.atproto.sync.subscribeRepos', 'commit'> } {
  return is$typed(v, id, 'commit')
}

export function validateCommit(v: unknown) {
  return lexicons.validate(`${id}#commit`, v) as ValidationResult<Commit>
}

/** Represents a change to an account's identity. Could be an updated handle, signing key, or pds hosting endpoint. Serves as a prod to all downstream services to refresh their identity cache. */
export interface Identity {
  seq: number
  did: string
  time: string
  /** The current handle for the account, or 'handle.invalid' if validation fails. This field is optional, might have been validated or passed-through from an upstream source. Semantics and behaviors for PDS vs Relay may evolve in the future; see atproto specs for more details. */
  handle?: string
  [k: string]: unknown
}

export function isIdentity(v: unknown): v is Identity & {
  $type: $Type<'com.atproto.sync.subscribeRepos', 'identity'>
} {
  return is$typed(v, id, 'identity')
}

export function validateIdentity(v: unknown) {
  return lexicons.validate(`${id}#identity`, v) as ValidationResult<Identity>
}

/** Represents a change to an account's status on a host (eg, PDS or Relay). The semantics of this event are that the status is at the host which emitted the event, not necessarily that at the currently active PDS. Eg, a Relay takedown would emit a takedown with active=false, even if the PDS is still active. */
export interface Account {
  seq: number
  did: string
  time: string
  /** Indicates that the account has a repository which can be fetched from the host that emitted this event. */
  active: boolean
  /** If active=false, this optional field indicates a reason for why the account is not active. */
  status?: 'takendown' | 'suspended' | 'deleted' | 'deactivated' | (string & {})
  [k: string]: unknown
}

export function isAccount(v: unknown): v is Account & {
  $type: $Type<'com.atproto.sync.subscribeRepos', 'account'>
} {
  return is$typed(v, id, 'account')
}

export function validateAccount(v: unknown) {
  return lexicons.validate(`${id}#account`, v) as ValidationResult<Account>
}

/** DEPRECATED -- Use #identity event instead */
export interface Handle {
  seq: number
  did: string
  handle: string
  time: string
  [k: string]: unknown
}

export function isHandle(
  v: unknown,
): v is Handle & { $type: $Type<'com.atproto.sync.subscribeRepos', 'handle'> } {
  return is$typed(v, id, 'handle')
}

export function validateHandle(v: unknown) {
  return lexicons.validate(`${id}#handle`, v) as ValidationResult<Handle>
}

/** DEPRECATED -- Use #account event instead */
export interface Migrate {
  seq: number
  did: string
  migrateTo: string | null
  time: string
  [k: string]: unknown
}

export function isMigrate(v: unknown): v is Migrate & {
  $type: $Type<'com.atproto.sync.subscribeRepos', 'migrate'>
} {
  return is$typed(v, id, 'migrate')
}

export function validateMigrate(v: unknown) {
  return lexicons.validate(`${id}#migrate`, v) as ValidationResult<Migrate>
}

/** DEPRECATED -- Use #account event instead */
export interface Tombstone {
  seq: number
  did: string
  time: string
  [k: string]: unknown
}

export function isTombstone(v: unknown): v is Tombstone & {
  $type: $Type<'com.atproto.sync.subscribeRepos', 'tombstone'>
} {
  return is$typed(v, id, 'tombstone')
}

export function validateTombstone(v: unknown) {
  return lexicons.validate(`${id}#tombstone`, v) as ValidationResult<Tombstone>
}

export interface Info {
  name: 'OutdatedCursor' | (string & {})
  message?: string
  [k: string]: unknown
}

export function isInfo(
  v: unknown,
): v is Info & { $type: $Type<'com.atproto.sync.subscribeRepos', 'info'> } {
  return is$typed(v, id, 'info')
}

export function validateInfo(v: unknown) {
  return lexicons.validate(`${id}#info`, v) as ValidationResult<Info>
}

/** A repo operation, ie a mutation of a single record. */
export interface RepoOp {
  action: 'create' | 'update' | 'delete' | (string & {})
  path: string
  /** For creates and updates, the new record CID. For deletions, null. */
  cid: CID | null
  [k: string]: unknown
}

export function isRepoOp(
  v: unknown,
): v is RepoOp & { $type: $Type<'com.atproto.sync.subscribeRepos', 'repoOp'> } {
  return is$typed(v, id, 'repoOp')
}

export function validateRepoOp(v: unknown) {
  return lexicons.validate(`${id}#repoOp`, v) as ValidationResult<RepoOp>
}
