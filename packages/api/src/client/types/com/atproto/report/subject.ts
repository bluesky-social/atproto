/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'

export interface Repo {
  /** The DID of the repo. */
  did: string
  [k: string]: unknown
}

export function isRepo(v: unknown): v is Repo {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.report.subject#repo'
  )
}

export function validateRepo(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.report.subject#repo', v)
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

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.report.subject#record'
  )
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.report.subject#record', v)
}

export interface RecordRef {
  uri: string
  cid: string
  [k: string]: unknown
}

export function isRecordRef(v: unknown): v is RecordRef {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'com.atproto.report.subject#recordRef'
  )
}

export function validateRecordRef(v: unknown): ValidationResult {
  return lexicons.validate('com.atproto.report.subject#recordRef', v)
}
