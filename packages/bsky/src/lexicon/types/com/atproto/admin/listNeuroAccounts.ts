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
const id = 'com.atproto.admin.listNeuroAccounts'

export type QueryParams = {
  /** Maximum number of accounts to return. */
  limit: number
  /** Pagination cursor. */
  cursor?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  accounts: NeuroAccountView[]
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

export interface NeuroAccountView {
  $type?: 'com.atproto.admin.listNeuroAccounts#neuroAccountView'
  did: string
  handle: string
  email?: string
  /** Neuro Legal ID (W ID) */
  neuroJid?: string
  linkedAt?: string
  lastLoginAt?: string
}

const hashNeuroAccountView = 'neuroAccountView'

export function isNeuroAccountView<V>(v: V) {
  return is$typed(v, id, hashNeuroAccountView)
}

export function validateNeuroAccountView<V>(v: V) {
  return validate<NeuroAccountView & V>(v, id, hashNeuroAccountView)
}
