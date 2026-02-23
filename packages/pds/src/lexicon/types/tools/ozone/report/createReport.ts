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
import type * as ComAtprotoAdminDefs from '../../../com/atproto/admin/defs.js'
import type * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.report.createReport'

export type QueryParams = {}

export interface InputSchema {
  reasonType: ToolsOzoneReportDefs.ReasonType
  /** Additional context about the content and violation. */
  reason?: string
  subject:
    | $Typed<ComAtprotoAdminDefs.RepoRef>
    | $Typed<ComAtprotoRepoStrongRef.Main>
    | { $type: string }
  modTool?: ModTool
}

export interface OutputSchema {
  id: number
  reasonType: ToolsOzoneReportDefs.ReasonType
  reason?: string
  subject:
    | $Typed<ComAtprotoAdminDefs.RepoRef>
    | $Typed<ComAtprotoRepoStrongRef.Main>
    | { $type: string }
  reportedBy: string
  createdAt: string
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

/** Moderation tool information for tracing the source of the action */
export interface ModTool {
  $type?: 'tools.ozone.report.createReport#modTool'
  /** Name/identifier of the source (e.g., 'bsky-app/android', 'bsky-web/chrome') */
  name: string
  /** Additional arbitrary metadata about the source */
  meta?: { [_ in string]: unknown }
}

const hashModTool = 'modTool'

export function isModTool<V>(v: V) {
  return is$typed(v, id, hashModTool)
}

export function validateModTool<V>(v: V) {
  return validate<ModTool & V>(v, id, hashModTool)
}
