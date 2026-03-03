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
const id = 'io.trustanchor.quicklogin.status'

export type QueryParams = {}

export interface InputSchema {
  /** Session identifier from init */
  sessionId: string
  /** Session token from init */
  sessionToken: string
}

export interface OutputSchema {
  /** Current session status */
  status: 'pending' | 'completed' | 'failed'
  /** When this session expires */
  expiresAt: string
  result?: LoginResult
  /** Error message if failed */
  error?: string
  /** Approval token for non-login sessions (delete_account, plc_operation). Present only when status is 'completed' and purpose is not 'login'. */
  approvalToken?: string
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

export interface LoginResult {
  $type?: 'io.trustanchor.quicklogin.status#loginResult'
  /** Access token */
  accessJwt: string
  /** Refresh token */
  refreshJwt: string
  /** User DID */
  did: string
  /** User handle */
  handle: string
  /** Whether account was newly created */
  created?: boolean
}

const hashLoginResult = 'loginResult'

export function isLoginResult<V>(v: V) {
  return is$typed(v, id, hashLoginResult)
}

export function validateLoginResult<V>(v: V) {
  return validate<LoginResult & V>(v, id, hashLoginResult)
}
