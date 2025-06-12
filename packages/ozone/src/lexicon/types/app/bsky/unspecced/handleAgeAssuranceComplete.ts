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
const id = 'app.bsky.unspecced.handleAgeAssuranceComplete'

export type QueryParams = {
  /** The status of the age assurance process. */
  status?: string
  /** Additional metadata provided when initiating age assurance. */
  externalPayload?: string
  /** SHA256 HMAC signature of the status and externalPayload, separated by a colon (:), and signed with the facilitating service's private key. */
  signature?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  /** The computed status of the age assurance process. */
  status: 'unknown' | 'pending' | 'assured' | (string & {})
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
