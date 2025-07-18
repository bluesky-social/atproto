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
const id = 'tools.ozone.communication.updateTemplate'

export type QueryParams = {}

export interface InputSchema {
  /** ID of the template to be updated. */
  id: string
  /** Name of the template. */
  name?: string
  /** Message language. */
  lang?: string
  /** Content of the template, markdown supported, can contain variable placeholders. */
  contentMarkdown?: string
  /** Subject of the message, used in emails. */
  subject?: string
  /** DID of the user who is updating the template. */
  updatedBy?: string
  disabled?: boolean
}

export type OutputSchema = ToolsOzoneCommunicationDefs.TemplateView

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
  error?: 'DuplicateTemplateName'
}

export type HandlerOutput = HandlerError | HandlerSuccess
