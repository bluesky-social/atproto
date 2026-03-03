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
const id = 'io.trustanchor.quicklogin.callback'

export type QueryParams = {}

export interface InputSchema {
  /** Session ID from init request */
  SessionId: string
  /** Authentication state (Approved/Rejected) */
  State: string
  /** User's JID from W ID app */
  JID?: string
  /** Provider domain */
  Provider?: string
  /** Domain used for authentication */
  Domain?: string
  /** Public key */
  Key?: string
  /** User properties from W ID */
  Properties?: { [_ in string]: unknown }
  /** Unix timestamp (seconds) when session was created */
  Created?: number
  /** Unix timestamp (seconds) when session was last updated */
  Updated?: number
  /** Unix timestamp (seconds) for start of validity period */
  From?: number
  /** Unix timestamp (seconds) for end of validity period */
  To?: number
}

export interface OutputSchema {}

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
}

export type HandlerOutput = HandlerError | HandlerSuccess
