/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'
import * as AppBskyActorDefs from '../actor/defs'

export const id = 'app.bsky.feed.getLikes'

export interface QueryParams {
  /** AT-URI of the subject (eg, a post record). */
  uri: string
  /** CID of the subject record (aka, specific version of record), to filter likes. */
  cid?: string
  limit: number
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  uri: string
  cid?: string
  cursor?: string
  likes: Like[]
}

export type HandlerInput = undefined

export interface HandlerSuccess {
  encoding: 'application/json'
  body: OutputSchema
  headers?: { [key: string]: string }
}

export interface HandlerError {
  status: number
  message?: string
}

export type HandlerOutput = HandlerError | HandlerSuccess | HandlerPipeThrough
export type HandlerReqCtx<HA extends HandlerAuth = never> = {
  auth: HA
  params: QueryParams
  input: HandlerInput
  req: express.Request
  res: express.Response
}
export type Handler<HA extends HandlerAuth = never> = (
  ctx: HandlerReqCtx<HA>,
) => Promise<HandlerOutput> | HandlerOutput

export interface Like {
  $type?: $Type<'app.bsky.feed.getLikes', 'like'>
  indexedAt: string
  createdAt: string
  actor: AppBskyActorDefs.ProfileView
}

export function isLike<V>(v: V) {
  return is$typed(v, id, 'like')
}

export function validateLike(v: unknown) {
  return lexicons.validate(`${id}#like`, v) as ValidationResult<Like>
}

export function isValidLike<V>(v: V): v is V & $Typed<Like> {
  return isLike(v) && validateLike(v).success
}
