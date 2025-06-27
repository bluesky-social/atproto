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
const id = 'com.atproto.identity.resolveDid'

export type QueryParams = {
  /** DID to resolve. */
  did: string
}
export type InputSchema = undefined

export interface OutputSchema {
  /** The complete DID document for the identity. */
  didDoc: { [_ in string]: unknown }
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
  error?: 'DidNotFound' | 'DidDeactivated'
}

export type HandlerOutput = HandlerError | HandlerSuccess
