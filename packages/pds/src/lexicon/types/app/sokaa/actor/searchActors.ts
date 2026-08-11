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
const id = 'app.sokaa.actor.searchActors'

export type QueryParams = {
  /** Search query (handle or display name). */
  q: string
  limit: number
  /** Pagination cursor from a previous response. */
  cursor?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  actors: AppSokaaActorDefs.ProfileViewBasic[]
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
