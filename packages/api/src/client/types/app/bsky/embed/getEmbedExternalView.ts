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
import type * as AppBskyEmbedExternal from './external.js'
import type * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.embed.getEmbedExternalView'

export type QueryParams = {
  /** AT-URIs of any Atmosphere records that can be resolved and used to construct #externalView views. Example: a site.standard.document and optionally its associated site.standard.publication. */
  uris: string[]
}
export type InputSchema = undefined

export interface OutputSchema {
  view?: AppBskyEmbedExternal.View
  /** StrongRefs (uri+cid) of the Atmosphere records that backed this view, suitable for embedding into a post's external.associatedRefs. */
  associatedRefs?: ComAtprotoRepoStrongRef.Main[]
  associatedRecords?: { [_ in string]: unknown }[]
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

export function toKnownErr(e: any) {
  return e
}
