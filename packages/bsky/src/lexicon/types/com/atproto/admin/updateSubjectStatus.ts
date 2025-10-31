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
import type * as ComAtprotoAdminDefs from './defs.js'
import type * as ComAtprotoRepoStrongRef from '../repo/strongRef.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'com.atproto.admin.updateSubjectStatus'

export type QueryParams = {}

export interface InputSchema {
  subject:
    | $Typed<ComAtprotoAdminDefs.RepoRef>
    | $Typed<ComAtprotoRepoStrongRef.Main>
    | $Typed<ComAtprotoAdminDefs.RepoBlobRef>
    | { $type: string }
  takedown?: ComAtprotoAdminDefs.StatusAttr
  deactivated?: ComAtprotoAdminDefs.StatusAttr
}

export interface OutputSchema {
  subject:
    | $Typed<ComAtprotoAdminDefs.RepoRef>
    | $Typed<ComAtprotoRepoStrongRef.Main>
    | $Typed<ComAtprotoAdminDefs.RepoBlobRef>
    | { $type: string }
  takedown?: ComAtprotoAdminDefs.StatusAttr
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
