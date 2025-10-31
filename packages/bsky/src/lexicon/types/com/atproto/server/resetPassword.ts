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
const id = 'com.atproto.server.resetPassword'

export type QueryParams = {}

export interface InputSchema {
  token: string
  password: string
}

export interface HandlerInput {
  encoding: 'application/json'
  body: InputSchema
}

export interface HandlerError {
  status: number
  message?: string
  error?: 'ExpiredToken' | 'InvalidToken'
}

export type HandlerOutput = HandlerError | void
