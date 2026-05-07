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
import type * as AppBskyEmbedExternal from './external.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.embed.getEmbedExternalView'

export type QueryParams = {
  /** AT-URI of the record whose external embed view should be returned. Example: a site.standard.document record. */
  uri: string
}
export type InputSchema = undefined
export type OutputSchema = AppBskyEmbedExternal.View
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
