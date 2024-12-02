/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'

export const id = 'app.bsky.feed.describeFeedGenerator'

export interface QueryParams {}

export type InputSchema = undefined

export interface OutputSchema {
  did: string
  feeds: Feed[]
  links?: Links
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
