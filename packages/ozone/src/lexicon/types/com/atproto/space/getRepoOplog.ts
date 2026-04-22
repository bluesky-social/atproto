/**
 * GENERATED CODE - DO NOT MODIFY
 */
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
const id = 'com.atproto.space.getRepoOplog'

export type QueryParams = {
  /** Reference to the space. */
  space: string
  /** The DID of the user whose oplog to retrieve. */
  did: string
  /** Return operations after this revision. */
  since?: string
  /** Maximum number of operations to return. */
  limit: number
}
export type InputSchema = undefined

export interface OutputSchema {
  ops: OpEntry[]
  /** Current hex-encoded set hash. */
  setHash?: string
  /** Current revision. */
  rev?: string
  cursor?: string
}

export type HandlerInput = void

export interface HandlerSuccess {
  encoding: 'application/json'
  body: OutputSchema
  headers?: { [key: string]: string }
}

export interface HandlerError {
  status: number
  message?: string
  error?: 'SpaceNotFound'
}

export type HandlerOutput = HandlerError | HandlerSuccess

export interface OpEntry {
  $type?: 'com.atproto.space.getRepoOplog#opEntry'
  rev: string
  idx: number
  action: 'create' | 'update' | 'delete' | (string & {})
  collection: string
  rkey: string
  cid?: string
  prev?: string
}

const hashOpEntry = 'opEntry'

export function isOpEntry<V>(v: V) {
  return is$typed(v, id, hashOpEntry)
}

export function validateOpEntry<V>(v: V) {
  return validate<OpEntry & V>(v, id, hashOpEntry)
}
