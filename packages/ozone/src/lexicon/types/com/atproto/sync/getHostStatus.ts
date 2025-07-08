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
import type * as ComAtprotoSyncDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'com.atproto.sync.getHostStatus'

export type QueryParams = {
  /** Hostname of the host (eg, PDS or relay) being queried. */
  hostname: string
}
export type InputSchema = undefined

export interface OutputSchema {
  hostname: string
  /** Recent repo stream event sequence number. May be delayed from actual stream processing (eg, persisted cursor not in-memory cursor). */
  seq?: number
  /** Number of accounts on the server which are associated with the upstream host. Note that the upstream may actually have more accounts. */
  accountCount?: number
  status?: ComAtprotoSyncDefs.HostStatus
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
  error?: 'HostNotFound'
}

export type HandlerOutput = HandlerError | HandlerSuccess
