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
import type * as ToolsOzoneSafelinkDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.safelink.addRule'

export interface QueryParams {}

export interface InputSchema {
  /** The URL or domain to apply the rule to */
  url: string
  pattern: ToolsOzoneSafelinkDefs.PatternType
  action: ToolsOzoneSafelinkDefs.ActionType
  reason: ToolsOzoneSafelinkDefs.ReasonType
  /** Optional comment about the decision */
  comment?: string
  /** Author DID. Only respected when using admin auth */
  createdBy?: string
}

export type OutputSchema = ToolsOzoneSafelinkDefs.Event

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
  qp?: QueryParams
  encoding?: 'application/json'
}

export interface Response {
  success: boolean
  headers: HeadersMap
  data: OutputSchema
}

export class InvalidUrlError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class RuleAlreadyExistsError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'InvalidUrl') return new InvalidUrlError(e)
    if (e.error === 'RuleAlreadyExists') return new RuleAlreadyExistsError(e)
  }

  return e
}
