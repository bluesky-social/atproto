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
import type * as AppBskyGraphDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.graph.getListsWithMembership'

export type QueryParams = {
  /** The account (actor) to check for membership. */
  actor: string
  limit: number
  cursor?: string
  /** Optional filter by list purpose. If not specified, all supported types are returned. */
  purposes?: 'modlist' | 'curatelist' | (string & {})[]
}
export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  listsWithMembership: ListWithMembership[]
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

/** A list and an optional list item indicating membership of a target user to that list. */
export interface ListWithMembership {
  $type?: 'app.bsky.graph.getListsWithMembership#listWithMembership'
  list: AppBskyGraphDefs.ListView
  listItem?: AppBskyGraphDefs.ListItemView
}

const hashListWithMembership = 'listWithMembership'

export function isListWithMembership<V>(v: V) {
  return is$typed(v, id, hashListWithMembership)
}

export function validateListWithMembership<V>(v: V) {
  return validate<ListWithMembership & V>(v, id, hashListWithMembership)
}
