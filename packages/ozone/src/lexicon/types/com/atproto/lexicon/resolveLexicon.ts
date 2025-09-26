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
import type * as ComAtprotoLexiconSchema from './schema.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'com.atproto.lexicon.resolveLexicon'

export type QueryParams = {
  /** The lexicon NSID to resolve. */
  nsid: string
}
export type InputSchema = undefined

export interface OutputSchema {
  /** The CID of the lexicon schema record. */
  cid: string
  schema: ComAtprotoLexiconSchema.Main
  /** The AT-URI of the lexicon schema record. */
  uri: string
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
  error?: 'LexiconNotFound'
}

export type HandlerOutput = HandlerError | HandlerSuccess
