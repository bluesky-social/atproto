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
const id = 'eu.wsocial.server.allocateWidForAccount'

export type QueryParams = {}
export type InputSchema = undefined

export interface OutputSchema {
  /** URL of the WID onboarding QR code image. Display this so the user can scan it with the W Identity app to provision their WID. */
  qrCodeUrl: string
  /** ISO timestamp after which this allocation expires and the QR code may no longer be valid. */
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
  error?: 'InventoryEmpty' | 'AlreadyLinked'
}

export type HandlerOutput = HandlerError | HandlerSuccess
