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
const id = 'app.bsky.contact.importContacts'

export type QueryParams = {}

export interface InputSchema {
  /** JWT to authenticate the call. Use the JWT received as a response to the call to `app.bsky.contact.verifyPhone`. */
  token: string
  /** List of phone numbers in global E.164 format (e.g., '+12125550123'). Phone numbers that cannot be normalized into a valid phone number will be discarded. Should not repeat the 'phone' input used in `app.bsky.contact.verifyPhone`. */
  contacts: string[]
}

export interface OutputSchema {
  /** The users that matched during import and their indexes on the input contacts, so the client can correlate with its local list. */
  matchesAndContactIndexes: AppBskyContactDefs.MatchAndContactIndex[]
}

export interface HandlerInput {
  encoding: 'application/json'
  body: InputSchema
}

export interface HandlerSuccess {
  encoding: 'application/json'
  body: OutputSchema
  headers?: { [key: string]: string }
}

export interface HandlerError {
  status: number
  message?: string
  error?:
    | 'InvalidDid'
    | 'InvalidContacts'
    | 'TooManyContacts'
    | 'InvalidToken'
    | 'InternalError'
}

export type HandlerOutput = HandlerError | HandlerSuccess
