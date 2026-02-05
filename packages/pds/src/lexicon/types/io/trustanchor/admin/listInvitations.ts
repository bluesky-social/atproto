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
const id = 'io.trustanchor.admin.listInvitations'

export type QueryParams = {
  /** Filter by invitation status */
  status: 'pending' | 'consumed' | 'expired' | 'revoked' | 'all'
  /** Filter invitations before this timestamp (ISO 8601) */
  before?: string
  /** Maximum number of results */
  limit: number
  /** Pagination cursor */
  cursor?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  invitations: Invitation[]
  cursor?: string
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

export interface Invitation {
  $type?: 'io.trustanchor.admin.listInvitations#invitation'
  id: number
  email: string
  preferredHandle?: string
  status: 'pending' | 'consumed' | 'expired' | 'revoked'
  invitationTimestamp?: number
  createdAt: string
  expiresAt: string
  consumedAt?: string
  consumingDid?: string
  consumingHandle?: string
}

const hashInvitation = 'invitation'

export function isInvitation<V>(v: V) {
  return is$typed(v, id, hashInvitation)
}

export function validateInvitation<V>(v: V) {
  return validate<Invitation & V>(v, id, hashInvitation)
}
