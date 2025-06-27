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
const id = 'com.atproto.identity.submitPlcOperation'

export type QueryParams = {}

export interface InputSchema {
  operation: { [_ in string]: unknown }
}

export interface HandlerInput {
  encoding: 'application/json'
  body: InputSchema
}

export interface HandlerError {
  status: number
  message?: string
}

export type HandlerOutput = HandlerError | void
