/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as ComAtprotoLabelDefs from './defs'

const id = 'com.atproto.label.subscribeLabels'

export interface Labels {
  seq: number
  labels: ComAtprotoLabelDefs.Label[]
  [k: string]: unknown
}

export function isLabels(v: unknown): v is Labels & {
  $type: $Type<'com.atproto.label.subscribeLabels', 'labels'>
} {
  return is$typed(v, id, 'labels')
}

export function validateLabels(v: unknown) {
  return lexicons.validate(`${id}#labels`, v) as ValidationResult<Labels>
}

export interface Info {
  name: 'OutdatedCursor' | (string & {})
  message?: string
  [k: string]: unknown
}

export function isInfo(
  v: unknown,
): v is Info & { $type: $Type<'com.atproto.label.subscribeLabels', 'info'> } {
  return is$typed(v, id, 'info')
}

export function validateInfo(v: unknown) {
  return lexicons.validate(`${id}#info`, v) as ValidationResult<Info>
}
