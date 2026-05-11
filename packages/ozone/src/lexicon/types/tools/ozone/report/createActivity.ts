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
const id = 'tools.ozone.report.createActivity'

export type QueryParams = {}

export interface InputSchema {
  /** ID of the report to record activity on */
  reportId: number
  activity:
    | $Typed<ToolsOzoneReportDefs.QueueActivity>
    | $Typed<ToolsOzoneReportDefs.AssignmentActivity>
    | $Typed<ToolsOzoneReportDefs.EscalationActivity>
    | $Typed<ToolsOzoneReportDefs.CloseActivity>
    | $Typed<ToolsOzoneReportDefs.ReopenActivity>
    | $Typed<ToolsOzoneReportDefs.NoteActivity>
    | { $type: string }
  /** Optional moderator-only note. Not visible to reporters. */
  internalNote?: string
  /** Optional public-facing note, potentially visible to the reporter. */
  publicNote?: string
  /** Set true when this activity is triggered by an automated process. Defaults to false. */
  isAutomated: boolean
}

export interface OutputSchema {
  activity: ToolsOzoneReportDefs.ReportActivityView
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
  error?: 'ReportNotFound' | 'InvalidStateTransition' | 'AlreadyInTargetState'
}

export type HandlerOutput = HandlerError | HandlerSuccess
