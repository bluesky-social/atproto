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
import type * as ToolsOzoneVerificationDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.verification.listVerifications'

export type QueryParams = {
  /** Pagination cursor */
  cursor?: string
  /** Maximum number of results to return */
  limit: number
  /** Filter to verifications created after this timestamp */
  createdAfter?: string
  /** Filter to verifications created before this timestamp */
  createdBefore?: string
  /** Filter to verifications from specific issuers */
  issuers?: string[]
  /** Filter to specific verified DIDs */
  subjects?: string[]
  /** Sort direction for creation date */
  sortDirection: 'asc' | 'desc'
  /** Filter to verifications that are revoked or not. By default, includes both. */
  isRevoked?: boolean
}
export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  verifications: ToolsOzoneVerificationDefs.VerificationView[]
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
