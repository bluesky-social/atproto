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

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.queue.deleteQueue'

export type QueryParams = {}

export interface InputSchema {
  /** ID of the queue to delete */
  queueId: number
  /** Optional: migrate all reports to this queue. If not specified, reports will be set to unassigned (-1). */
  migrateToQueueId?: number
}

export interface OutputSchema {
  deleted: boolean
  /** Number of reports that were migrated (if migration occurred) */
  reportsMigrated?: number
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
}

export type HandlerOutput = HandlerError | HandlerSuccess
