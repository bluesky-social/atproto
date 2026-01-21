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
const id = 'com.atproto.server.updateEmail'

export type QueryParams = {}

export interface InputSchema {
  email: string
  emailAuthFactor?: boolean
  /** Requires a token from com.atproto.sever.requestEmailUpdate if the account's email has been confirmed. */
  token?: string
}

export interface HandlerInput {
  encoding: 'application/json'
  body: InputSchema
}

export interface HandlerError {
  status: number
  message?: string
  error?: 'ExpiredToken' | 'InvalidToken' | 'TokenRequired'
}

export type HandlerOutput = HandlerError | void
