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
import type * as AppBskyContactDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.contact.getSyncStatus'

export type QueryParams = {}
export type InputSchema = undefined

export interface OutputSchema {
  syncStatus?: AppBskyContactDefs.SyncStatus
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
  error?: 'InvalidDid' | 'InternalError'
}

export type HandlerOutput = HandlerError | HandlerSuccess
