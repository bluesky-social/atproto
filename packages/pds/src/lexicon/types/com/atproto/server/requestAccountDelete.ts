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
const id = 'com.atproto.server.requestAccountDelete'

export type QueryParams = {}
export type InputSchema = undefined
export type HandlerInput = void

export interface HandlerError {
  status: number
  message?: string
}

export type HandlerOutput = HandlerError | void
