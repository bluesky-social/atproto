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
const id = 'com.atproto.server.getServiceAuth'

export type QueryParams = {
  /** The DID of the service that the token will be used to authenticate with */
  aud: string
  /** The time in Unix Epoch seconds that the JWT expires. Defaults to 60 seconds in the future. The service may enforce certain time bounds on tokens depending on the requested scope. */
  exp?: number
  /** Lexicon (XRPC) method to bind the requested token to */
  lxm?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  token: string
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
  error?: 'BadExpiration'
}

export type HandlerOutput = HandlerError | HandlerSuccess
