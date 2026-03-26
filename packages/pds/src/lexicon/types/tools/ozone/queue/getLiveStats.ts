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
import type * as ToolsOzoneQueueDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.queue.getLiveStats'

export type QueryParams = {
  /** Filter stats by queue. Cannot filter by both queue and moderator. */
  queueId?: number
  /** Filter stats by moderator. Cannot filter by both queue and moderator. */
  moderatorDid?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  stats: ToolsOzoneQueueDefs.QueueStats
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
