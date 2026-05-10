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
const id = 'eu.wsocial.quicklogin.linkWid'

export type QueryParams = {}

export interface InputSchema {}

export interface OutputSchema {
  /** Session ID — pass to io.trustanchor.quicklogin.status to poll. */
  sessionId: string
  /** Secret token — pass to io.trustanchor.quicklogin.status to authenticate the poll. */
  sessionToken: string
  /** Data URL of the QR code image to display. */
  qrCodeUrl: string
  /** ISO timestamp after which the session is expired. */
  expiresAt: string
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
