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
const id = 'com.atproto.sync.listReposByCollection'

export type QueryParams = {
  collection: string
  /** Maximum size of response set. Recommend setting a large maximum (1000+) when enumerating large DID lists. */
  limit: number
  cursor?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  repos: Repo[]
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
}

export type HandlerOutput = HandlerError | HandlerSuccess

export interface Repo {
  $type?: 'com.atproto.sync.listReposByCollection#repo'
  did: string
}

const hashRepo = 'repo'

export function isRepo<V>(v: V) {
  return is$typed(v, id, hashRepo)
}

export function validateRepo<V>(v: V) {
  return validate<Repo & V>(v, id, hashRepo)
}
