/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as ToolsOzoneModeratorDefs from './defs'

export interface QueryParams {}

export interface InputSchema {
  did: string
  disabled: boolean
  role:
    | 'tools.ozone.moderator.defs#modRoleAdmin'
    | 'tools.ozone.moderator.defs#modRoleModerator'
    | 'tools.ozone.moderator.defs#modRoleTriage'
    | (string & {})
  [k: string]: unknown
}

export type OutputSchema = ToolsOzoneModeratorDefs.User

export interface CallOptions {
  headers?: Headers
  qp?: QueryParams
  encoding: 'application/json'
}

export interface Response {
  success: boolean
  headers: Headers
  data: OutputSchema
}

export class UserAlreadyExistsError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers)
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'UserAlreadyExists')
      return new UserAlreadyExistsError(e)
  }
  return e
}
