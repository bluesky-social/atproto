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
const id = 'com.atproto.admin.getNeuroLink'

export type QueryParams = {
  /** The DID of the account. */
  did: string
}
export type InputSchema = undefined

export interface OutputSchema {
  did: string
  handle: string
  email?: string
  /** Neuro Legal ID (W ID) for real users */
  legalId?: string
  /** Neuro JID for test users */
  jid?: string
  /** Whether this is a test user account */
  isTestUser?: boolean
  linkedAt?: string
  lastLoginAt?: string
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
