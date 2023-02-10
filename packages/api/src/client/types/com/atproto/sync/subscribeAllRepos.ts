/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'

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
