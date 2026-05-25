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
const id = 'eu.wsocial.server.requestAccountDelete'

export type QueryParams = {}
export type InputSchema = undefined

export interface OutputSchema {
  /** Which deletion flow(s) are available. 'wid' = WID QR scan only (no real email on account). 'email' = email token only (no WID). 'wid+email' = both flows are available; a QR session has been started and an email token has been sent. */
  method: 'wid' | 'email' | 'wid+email' | (string & {})
  /** Present when method is 'wid' or 'wid+email'. The QuickLogin session ID for polling status. */
  sessionId?: string
  /** Present when method is 'wid' or 'wid+email'. Opaque session token for authenticating polling requests. */
  sessionToken?: string
  /** Present when method is 'wid' or 'wid+email'. Base64 image data URL of the QR code to display. */
  qrCodeUrl?: string
  /** Present when method is 'wid' or 'wid+email'. ISO timestamp after which the QR session expires. */
  expiresAt?: string
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
  error?: 'NoDeleteMethod'
}

export type HandlerOutput = HandlerError | HandlerSuccess
