/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons.js'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util.js'
import type * as AppBskyEmbedExternal from './external.js'
import type * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.embed.getEmbedExternalView'

export type QueryParams = {
  /** The canonical web URL the embed represents (typically the URL the user pasted into the composer). Used as the returned view's `uri`. May be used for validation in the future. */
  url: string
  /** AT-URIs of any Atmosphere records that can be resolved and used to construct #externalView views. Example: a site.standard.document and optionally its associated site.standard.publication. */
  uris: string[]
}
export type InputSchema = undefined

export interface OutputSchema {
  view?: AppBskyEmbedExternal.View
  /** StrongRefs (URI+CID) of the Atmosphere records that backed this view, suitable for embedding into a post's external.associatedRefs. */
  associatedRefs?: ComAtprotoRepoStrongRef.Main[]
  associatedRecords?: { [_ in string]: unknown }[]
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
