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
import type * as AppSokaaActorDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.sokaa.actor.getProfile'

export type QueryParams = {
  /** The handle or DID of the account to fetch. */
  actor: string
}
export type InputSchema = undefined
export type OutputSchema = AppSokaaActorDefs.ProfileView
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
