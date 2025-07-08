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
import type * as ToolsOzoneSafelinkDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.safelink.removeRule'

export type QueryParams = {}

export interface InputSchema {
  /** The URL or domain to remove the rule for */
  url: string
  pattern: ToolsOzoneSafelinkDefs.PatternType
  /** Optional comment about why the rule is being removed */
  comment?: string
  /** Optional DID of the user. Only respected when using admin auth. */
  createdBy?: string
}

export type OutputSchema = ToolsOzoneSafelinkDefs.Event

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
  error?: 'RuleNotFound'
}

export type HandlerOutput = HandlerError | HandlerSuccess
