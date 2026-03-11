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
import type * as ToolsOzoneModerationDefs from './defs.js'
import type * as ComAtprotoAdminDefs from '../../../com/atproto/admin/defs.js'
import type * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.moderation.emitEvents'

export type QueryParams = {}

export interface InputSchema {
  event:
    | $Typed<ToolsOzoneModerationDefs.ModEventTakedown>
    | $Typed<ToolsOzoneModerationDefs.ModEventAcknowledge>
    | $Typed<ToolsOzoneModerationDefs.ModEventLabel>
    | $Typed<ToolsOzoneModerationDefs.ModEventReport>
    | $Typed<ToolsOzoneModerationDefs.ModEventReverseTakedown>
    | $Typed<ToolsOzoneModerationDefs.ModEventResolveAppeal>
    | $Typed<ToolsOzoneModerationDefs.ModEventEmail>
    | $Typed<ToolsOzoneModerationDefs.ModEventTag>
    | $Typed<ToolsOzoneModerationDefs.RevokeAccountCredentialsEvent>
    | { $type: string }
  /** Array of subjects to apply the moderation event to. */
  subjects: SubjectEntry[]
  createdBy: string
  modTool?: ToolsOzoneModerationDefs.ModTool
}

export interface OutputSchema {
  /** Successfully processed moderation events. */
  events: ToolsOzoneModerationDefs.ModEventView[]
  /** Events that failed to process. */
  failedEvents: FailedEvent[]
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

/** A subject with optional per-subject blob CIDs. */
export interface SubjectEntry {
  $type?: 'tools.ozone.moderation.emitEvents#subjectEntry'
  subject:
    | $Typed<ComAtprotoAdminDefs.RepoRef>
    | $Typed<ComAtprotoRepoStrongRef.Main>
    | { $type: string }
  subjectBlobCids?: string[]
}

const hashSubjectEntry = 'subjectEntry'

export function isSubjectEntry<V>(v: V) {
  return is$typed(v, id, hashSubjectEntry)
}

export function validateSubjectEntry<V>(v: V) {
  return validate<SubjectEntry & V>(v, id, hashSubjectEntry)
}

/** An event that failed to process. */
export interface FailedEvent {
  $type?: 'tools.ozone.moderation.emitEvents#failedEvent'
  /** Error message describing the reason for failure. */
  error: string
  subject:
    | $Typed<ComAtprotoAdminDefs.RepoRef>
    | $Typed<ComAtprotoRepoStrongRef.Main>
    | { $type: string }
}

const hashFailedEvent = 'failedEvent'

export function isFailedEvent<V>(v: V) {
  return is$typed(v, id, hashFailedEvent)
}

export function validateFailedEvent<V>(v: V) {
  return validate<FailedEvent & V>(v, id, hashFailedEvent)
}
