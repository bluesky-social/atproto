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
import type * as ComAtprotoServerDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'com.atproto.server.getAccountInviteCodes'

export type QueryParams = {
  includeUsed: boolean
  /** Controls whether any new 'earned' but not 'created' invites should be created. */
  createAvailable: boolean
}
export type InputSchema = undefined

export interface OutputSchema {
  codes: ComAtprotoServerDefs.InviteCode[]
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
  error?: 'DuplicateCreate'
}

export type HandlerOutput = HandlerError | HandlerSuccess
