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
const id = 'io.trustanchor.quicklogin.init'

export type QueryParams = {}

export interface InputSchema {
  /** Allow automatic account creation if JID not found */
  allowCreate?: boolean
}

export interface OutputSchema {
  /** Unique session identifier */
  sessionId: string
  /** Secret token for polling status */
  sessionToken: string
  /** Service ID from provider for QR generation */
  serviceId: string
  /** When this session expires */
  expiresAt: string
  /** Provider base URL for fetching QR code */
  providerBaseUrl: string
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
}

export type HandlerOutput = HandlerError | HandlerSuccess
