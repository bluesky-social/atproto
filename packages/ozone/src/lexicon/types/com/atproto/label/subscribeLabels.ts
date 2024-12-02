/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { HandlerAuth, ErrorFrame } from '@atproto/xrpc-server'
import { IncomingMessage } from 'http'
import * as ComAtprotoLabelDefs from './defs'

export const id = 'com.atproto.label.subscribeLabels'

export interface QueryParams {
  /** The last known event seq number to backfill from. */
  cursor?: number
}

export type OutputSchema = $Typed<Labels> | $Typed<Info> | { $type: string }
export type HandlerError = ErrorFrame<'FutureCursor'>
export type HandlerOutput = HandlerError | OutputSchema
export type HandlerReqCtx<HA extends HandlerAuth = never> = {
  auth: HA
  params: QueryParams
  req: IncomingMessage
  signal: AbortSignal
}
export type Handler<HA extends HandlerAuth = never> = (
  ctx: HandlerReqCtx<HA>,
) => AsyncIterable<HandlerOutput>

export interface Labels {
  $type?: $Type<'com.atproto.label.subscribeLabels', 'labels'>
  seq: number
  labels: ComAtprotoLabelDefs.Label[]
}

export function isLabels<V>(v: V) {
  return is$typed(v, id, 'labels')
}

export function validateLabels(v: unknown) {
  return lexicons.validate(`${id}#labels`, v) as ValidationResult<Labels>
}

export function isValidLabels<V>(v: V): v is V & $Typed<Labels> {
  return isLabels(v) && validateLabels(v).success
}

export interface Info {
  $type?: $Type<'com.atproto.label.subscribeLabels', 'info'>
  name: 'OutdatedCursor' | (string & {})
  message?: string
}

export function isInfo<V>(v: V) {
  return is$typed(v, id, 'info')
}

export function validateInfo(v: unknown) {
  return lexicons.validate(`${id}#info`, v) as ValidationResult<Info>
}

export function isValidInfo<V>(v: V): v is V & $Typed<Info> {
  return isInfo(v) && validateInfo(v).success
}
