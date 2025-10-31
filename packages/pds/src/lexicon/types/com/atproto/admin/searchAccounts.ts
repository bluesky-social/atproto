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
import type * as ComAtprotoAdminDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'com.atproto.admin.searchAccounts'

export type QueryParams = {
  email?: string
  cursor?: string
  limit: number
}
export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  accounts: ComAtprotoAdminDefs.AccountView[]
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
