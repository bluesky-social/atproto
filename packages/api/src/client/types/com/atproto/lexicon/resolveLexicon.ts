/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
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

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
}

export interface Response {
  success: boolean
  headers: HeadersMap
  data: OutputSchema
}

export class LexiconNotFoundError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'LexiconNotFound') return new LexiconNotFoundError(e)
  }

  return e
}
