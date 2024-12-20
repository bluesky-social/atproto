/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import {
  isValid as _isValid,
  validate as _validate,
} from '../../../../lexicons'
import { $Type, $Typed, is$typed as _is$typed, OmitKey } from '../../../../util'

const is$typed = _is$typed,
  isValid = _isValid,
  validate = _validate
const id = 'app.bsky.feed.describeFeedGenerator'

export interface QueryParams {}

export type InputSchema = undefined

export interface OutputSchema {
  did: string
  feeds: Feed[]
  links?: Links
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

export interface Feed {
  $type?: $Type<'app.bsky.feed.describeFeedGenerator', 'feed'>
  uri: string
}

const hashFeed = 'feed'

export function isFeed<V>(v: V) {
  return is$typed(v, id, hashFeed)
}

export function validateFeed<V>(v: V) {
  return validate<Feed & V>(v, id, hashFeed)
}

export function isValidFeed<V>(v: V) {
  return isValid<Feed>(v, id, hashFeed)
}

export interface Links {
  $type?: $Type<'app.bsky.feed.describeFeedGenerator', 'links'>
  privacyPolicy?: string
  termsOfService?: string
}

const hashLinks = 'links'

export function isLinks<V>(v: V) {
  return is$typed(v, id, hashLinks)
}

export function validateLinks<V>(v: V) {
  return validate<Links & V>(v, id, hashLinks)
}

export function isValidLinks<V>(v: V) {
  return isValid<Links>(v, id, hashLinks)
}
