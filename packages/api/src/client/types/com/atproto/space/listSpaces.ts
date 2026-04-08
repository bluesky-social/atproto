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

const is$typed = _is$typed,
  validate = _validate
const id = 'com.atproto.space.listSpaces'

export type QueryParams = {
  /** The number of spaces to return. */
  limit?: number
  cursor?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  spaces: SpaceView[]
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

export interface SpaceView {
  $type?: 'com.atproto.space.listSpaces#spaceView'
  /** URI of the space. */
  uri: string
  /** Whether the authenticated user is the owner of the space. */
  isOwner: boolean
}

const hashSpaceView = 'spaceView'

export function isSpaceView<V>(v: V) {
  return is$typed(v, id, hashSpaceView)
}

export function validateSpaceView<V>(v: V) {
  return validate<SpaceView & V>(v, id, hashSpaceView)
}
