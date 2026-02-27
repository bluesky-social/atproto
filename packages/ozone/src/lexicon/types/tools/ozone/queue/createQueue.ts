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
const id = 'tools.ozone.queue.createQueue'

export type QueryParams = {}

export interface InputSchema {
  /** Display name for the queue (must be unique) */
  name: string
  /** Subject types this queue accepts */
  subjectTypes: ('account' | 'record' | 'message' | (string & {}))[]
  /** Collection name for record subjects. Required if subjectTypes includes 'record'. */
  collection?: string
  /** Report reason types (fully qualified NSIDs) */
  reportTypes: string[]
}

export interface OutputSchema {
  queue: ToolsOzoneQueueDefs.QueueView
}

export interface HandlerInput {
  encoding: 'application/json'
  body: InputSchema
}

export interface HandlerSuccess {
  encoding: 'application/json'
  body: OutputSchema
  headers?: { [key: string]: string }
}

export interface HandlerError {
  status: number
  message?: string
  error?: 'ConflictingQueue'
}

export type HandlerOutput = HandlerError | HandlerSuccess
