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
const id = 'tools.ozone.queue.routeReports'

export type QueryParams = {}

export interface InputSchema {
  /** Start of report ID range (inclusive). */
  startReportId: number
  /** End of report ID range (inclusive). Difference between start and end must be less than 5,000. */
  endReportId: number
}

export interface OutputSchema {
  /** The number of reports assigned to a queue. */
  assigned: number
  /** The number of reports with no matching queue. */
  unmatched: number
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
  error?: 'OutOfRange'
}

export type HandlerOutput = HandlerError | HandlerSuccess
