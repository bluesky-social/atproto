/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'

export const id = 'app.bsky.feed.describeFeedGenerator'

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

export function isFeed<V>(v: V) {
  return is$typed(v, id, 'feed')
}

export function validateFeed(v: unknown) {
  return lexicons.validate(`${id}#feed`, v) as ValidationResult<Feed>
}

export function isValidFeed<V>(v: V): v is V & $Typed<Feed> {
  return isFeed(v) && validateFeed(v).success
}

export interface Links {
  $type?: $Type<'app.bsky.feed.describeFeedGenerator', 'links'>
  privacyPolicy?: string
  termsOfService?: string
}

export function isLinks<V>(v: V) {
  return is$typed(v, id, 'links')
}

export function validateLinks(v: unknown) {
  return lexicons.validate(`${id}#links`, v) as ValidationResult<Links>
}

export function isValidLinks<V>(v: V): v is V & $Typed<Links> {
  return isLinks(v) && validateLinks(v).success
}
