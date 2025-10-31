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
import type * as ToolsOzoneCommunicationDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.communication.listTemplates'

export type QueryParams = {}
export type InputSchema = undefined

export interface OutputSchema {
  communicationTemplates: ToolsOzoneCommunicationDefs.TemplateView[]
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
