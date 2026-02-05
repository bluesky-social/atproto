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
const id = 'io.trustanchor.admin.purgeInvitations'

export type QueryParams = {}

export interface InputSchema {
  /** Status of invitations to purge */
  status: 'consumed' | 'expired' | 'revoked'
  /** Purge invitations before this timestamp (ISO 8601) */
  before?: string
}

export interface OutputSchema {
  /** Number of invitations deleted */
  deletedCount: number
  status: string
  before?: string
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
