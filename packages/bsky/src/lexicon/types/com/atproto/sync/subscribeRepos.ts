/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'
import { HandlerAuth, ErrorFrame } from '@atproto/xrpc-server'
import { IncomingMessage } from 'http'

export interface QueryParams {
  /** The last known event to backfill from. */
  cursor?: number
}

export type OutputSchema =
  | Commit
  | Handle
  | Migrate
  | Tombstone
  | Info
  | { $type: string; [k: string]: unknown }
export type HandlerError = ErrorFrame<'FutureCursor' | 'ConsumerTooSlow'>
export type HandlerOutput = HandlerError | OutputSchema
export type HandlerReqCtx<HA extends HandlerAuth = never> = {
  auth: HA
  params: QueryParams
  req: IncomingMessage
  signal: AbortSignal
}
export type Handler<HA extends HandlerAuth = never> = (
  ctx: HandlerReqCtx<HA>,
) => AsyncIterable<HandlerOutput>

export interface Commit {
  seq: number
  rebase: boolean
  tooBig: boolean
  repo: string
  commit: CID
  prev?: CID | null
  /** The rev of the emitted commit */
  rev: string
  /** The rev of the last emitted commit from this repo */
  since: string | null
  /** CAR file containing relevant blocks */
  blocks: Uint8Array
  ops: RepoOp[]
  blobs: CID[]
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

/** A repo operation, ie a write of a single record. For creates and updates, cid is the record's CID as of this operation. For deletes, it's null. */
export interface RepoOp {
  action: 'create' | 'update' | 'delete' | (string & {})
  path: string
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
