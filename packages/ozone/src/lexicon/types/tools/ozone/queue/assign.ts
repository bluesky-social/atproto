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
const id = 'tools.ozone.queue.assign'

export type QueryParams = {}

export interface InputSchema {
  /** The ID of the queue to assign the user to. */
  queueId: number
  /** DID to be assigned. Assigns to whomever sent the request if not provided. */
  did?: string
  /** Whether to assign the queue to the user. Defaults to true. */
  assign?: boolean
}

export type OutputSchema = ToolsOzoneQueueDefs.AssignmentView

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
}

export type HandlerOutput = HandlerError | HandlerSuccess
