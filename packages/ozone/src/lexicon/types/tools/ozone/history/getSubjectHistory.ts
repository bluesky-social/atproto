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
import type * as ToolsOzoneHistoryDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.history.getSubjectHistory'

export type QueryParams = {
  subject: string
  limit: number
  cursor?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  events: ToolsOzoneHistoryDefs.EventView[]
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
