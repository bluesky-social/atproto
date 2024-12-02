/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as ComAtprotoLabelDefs from './defs'

export const id = 'com.atproto.label.subscribeLabels'

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
