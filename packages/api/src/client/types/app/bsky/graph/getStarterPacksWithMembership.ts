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
import type * as AppBskyGraphDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.graph.getStarterPacksWithMembership'

export type QueryParams = {
  /** The account (actor) to check for membership. */
  actor: string
  limit?: number
  cursor?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  starterPacksWithMembership: StarterPackWithMembership[]
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

/** A starter pack and an optional list item indicating membership of a target user to that starter pack. */
export interface StarterPackWithMembership {
  $type?: 'app.bsky.graph.getStarterPacksWithMembership#starterPackWithMembership'
  starterPack: AppBskyGraphDefs.StarterPackView
  listItem?: AppBskyGraphDefs.ListItemView
}

const hashStarterPackWithMembership = 'starterPackWithMembership'

export function isStarterPackWithMembership<V>(v: V) {
  return is$typed(v, id, hashStarterPackWithMembership)
}

export function validateStarterPackWithMembership<V>(v: V) {
  return validate<StarterPackWithMembership & V>(
    v,
    id,
    hashStarterPackWithMembership,
  )
}
