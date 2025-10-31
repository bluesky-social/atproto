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
import type * as ComAtprotoLabelDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'com.atproto.label.subscribeLabels'

export interface Labels {
  $type?: 'com.atproto.label.subscribeLabels#labels'
  seq: number
  labels: ComAtprotoLabelDefs.Label[]
}

const hashLabels = 'labels'

export function isLabels<V>(v: V) {
  return is$typed(v, id, hashLabels)
}

export function validateLabels<V>(v: V) {
  return validate<Labels & V>(v, id, hashLabels)
}

export interface Info {
  $type?: 'com.atproto.label.subscribeLabels#info'
  name: 'OutdatedCursor' | (string & {})
  message?: string
}

const hashInfo = 'info'

export function isInfo<V>(v: V) {
  return is$typed(v, id, hashInfo)
}

export function validateInfo<V>(v: V) {
  return validate<Info & V>(v, id, hashInfo)
}
