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
const id = 'tools.ozone.queue.listQueues'

export type QueryParams = {
  /** Filter by enabled status. If not specified, returns all queues. */
  enabled?: boolean
  /** Filter queues that handle this subject type ('account' or 'record'). */
  subjectType?: string
  /** Filter queues by collection name (e.g. 'app.bsky.feed.post'). */
  collection?: string
  /** Filter queues that handle any of these report reason types. */
  reportTypes?: string[]
  limit: number
  cursor?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  queues: ToolsOzoneQueueDefs.QueueView[]
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
