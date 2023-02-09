/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { HandlerAuth, InfoFrame, ErrorFrame } from '@atproto/xrpc-server'
import { IncomingMessage } from 'http'

export interface QueryParams {
  /** The last known event to backfill from. Does not dedupe as there may be an overlap in timestamps. */
  backfillFrom?: string
}

export type OutputSchema =
  | RepoAppend
  | RepoRebase
  | { $type: string; [k: string]: unknown }
export type HandlerError = ErrorFrame<never>
export type HandlerInfo = InfoFrame<never>
export type HandlerOutput = HandlerInfo | HandlerError | OutputSchema
export type Handler<HA extends HandlerAuth = never> = (ctx: {
  auth: HA
  params: QueryParams
  req: IncomingMessage
}) => AsyncIterable<HandlerOutput>

export interface RepoAppend {
  time: string
  repo: string
  commit: string
  prev?: string
  blocks: {}
  blobs: string[]
  [k: string]: unknown
}

export function isRepoAppend(v: unknown): v is RepoAppend {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.sync.subscribeAllRepos#repoAppend'
  )
}

export function validateRepoAppend(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.sync.subscribeAllRepos#repoAppend', v)
}

export interface RepoRebase {
  time: string
  repo: string
  commit: string
  [k: string]: unknown
}

export function isRepoRebase(v: unknown): v is RepoRebase {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.sync.subscribeAllRepos#repoRebase'
  )
}

export function validateRepoRebase(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.sync.subscribeAllRepos#repoRebase', v)
}
