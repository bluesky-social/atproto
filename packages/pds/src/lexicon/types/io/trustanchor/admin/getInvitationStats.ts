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
const id = 'io.trustanchor.admin.getInvitationStats'

export type QueryParams = {
  /** Calculate consumed count since this timestamp (ISO 8601) */
  since?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  /** Number of pending invitations */
  pending: number
  /** Total number of consumed invitations */
  consumed: number
  /** Number of expired invitations */
  expired: number
  /** Number of revoked invitations */
  revoked: number
  /** Number consumed since the 'since' parameter (if provided) */
  consumedSince?: number
  /** Ratio of consumed to total (consumed + expired) as string */
  conversionRate?: string
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
