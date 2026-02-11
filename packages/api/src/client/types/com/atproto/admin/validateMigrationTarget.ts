/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
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
const id = 'com.atproto.admin.validateMigrationTarget'

export type QueryParams = {
  /** DID to migrate */
  did: string
  /** W ID (Neuro Legal ID) if account has one */
  legalId?: string
  /** New handle on target (if changing) */
  targetHandle?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  /** Whether target PDS can accept this migration */
  canAccept: boolean
  checks?: ValidationChecks
  /** Error message if canAccept is false */
  error?: string
}

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
}

export interface Response {
  success: boolean
  headers: HeadersMap
  data: OutputSchema
}

export function toKnownErr(e: any) {
  return e
}

/** Detailed validation check results */
export interface ValidationChecks {
  $type?: 'com.atproto.admin.validateMigrationTarget#validationChecks'
  /** True if DID does not exist on target */
  didAvailable?: boolean
  /** True if W ID is not linked to another account */
  legalIdAvailable?: boolean
  /** True if handle is available on target */
  handleAvailable?: boolean
}

const hashValidationChecks = 'validationChecks'

export function isValidationChecks<V>(v: V) {
  return is$typed(v, id, hashValidationChecks)
}

export function validateValidationChecks<V>(v: V) {
  return validate<ValidationChecks & V>(v, id, hashValidationChecks)
}
