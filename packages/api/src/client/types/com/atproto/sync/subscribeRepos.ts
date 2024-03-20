/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'

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

export function isCommit(v: unknown): v is Commit {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.sync.subscribeRepos#commit'
  )
}

export function validateCommit(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.sync.subscribeRepos#commit', v)
}

/** Represents a change to an account's identity. Could be an updated handle, signing key, or pds hosting endpoint. Serves as a prod to all downstream services to refresh their identity cache. */
export interface Identity {
  seq: number
  did: string
  time: string
  [k: string]: unknown
}

export function isIdentity(v: unknown): v is Identity {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.sync.subscribeRepos#identity'
  )
}

export function validateIdentity(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.sync.subscribeRepos#identity', v)
}

/** Represents an update of the account's handle, or transition to/from invalid state. NOTE: Will be deprecated in favor of #identity. */
export interface Handle {
  seq: number
  did: string
  handle: string
  time: string
  [k: string]: unknown
}

export function isHandle(v: unknown): v is Handle {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.sync.subscribeRepos#handle'
  )
}

export function validateHandle(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.sync.subscribeRepos#handle', v)
}

/** Represents an account moving from one PDS instance to another. NOTE: not implemented; account migration uses #identity instead */
export interface Migrate {
  seq: number
  did: string
  migrateTo: string | null
  time: string
  [k: string]: unknown
}

export function isMigrate(v: unknown): v is Migrate {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.sync.subscribeRepos#migrate'
  )
}

export function validateMigrate(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.sync.subscribeRepos#migrate', v)
}

/** Indicates that an account has been deleted. NOTE: may be deprecated in favor of #identity or a future #account event */
export interface Tombstone {
  seq: number
  did: string
  time: string
  [k: string]: unknown
}

export function isTombstone(v: unknown): v is Tombstone {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.sync.subscribeRepos#tombstone'
  )
}

export function validateTombstone(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.sync.subscribeRepos#tombstone', v)
}

export interface Info {
  name: 'OutdatedCursor' | (string & {})
  message?: string
  [k: string]: unknown
}

export function isInfo(v: unknown): v is Info {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.sync.subscribeRepos#info'
  )
}

export function validateInfo(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.sync.subscribeRepos#info', v)
}

/** A repo operation, ie a mutation of a single record. */
export interface RepoOp {
  action: 'create' | 'update' | 'delete' | (string & {})
  path: string
  /** For creates and updates, the new record CID. For deletions, null. */
  cid: CID | null
  [k: string]: unknown
}

export function isRepoOp(v: unknown): v is RepoOp {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.sync.subscribeRepos#repoOp'
  )
}

export function validateRepoOp(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.sync.subscribeRepos#repoOp', v)
}
