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
const id = 'tools.ozone.queue.getAssignments'

export type QueryParams = {
  /** When true, only returns active assignments where endAt is in the future. */
  onlyActiveAssignments?: boolean
  /** If specified, returns assignments for these queues only. */
  queueIds?: number[]
  /** If specified, returns assignments for these moderators only. */
  dids?: string[]
  /** If specified as a DID, returns assignments for all records and the DID. If specified as an AT-URI, returns assignments for that URI only. */
  subject?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  assignments: ToolsOzoneQueueDefs.AssignmentView[]
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
