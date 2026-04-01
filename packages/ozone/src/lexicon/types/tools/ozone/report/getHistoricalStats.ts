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
import type * as ToolsOzoneReportDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.report.getHistoricalStats'

export type QueryParams = {
  /** Filter stats by queue. Use -1 for unqueued reports. */
  queueId?: number
  /** Filter stats by moderator DID. */
  moderatorDid?: string
  /** Filter stats by report types. */
  reportTypes?: string[]
  /** Earliest date to include (inclusive). */
  startDate?: string
  /** Latest date to include (inclusive). */
  endDate?: string
  /** Maximum number of entries to return. */
  limit: number
  /** Pagination cursor. */
  cursor?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  stats: ToolsOzoneReportDefs.HistoricalStats[]
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
