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
const id = 'io.trustanchor.server.requestAccountDeleteWID'

export type QueryParams = {}
export type InputSchema = undefined

export interface OutputSchema {
  /** QuickLogin session ID for polling status */
  sessionId: string
  /** Secret token for polling status */
  sessionToken: string
  /** QR code image URL for display */
  qrCodeUrl: string
  /** When this session expires */
  expiresAt: string
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
