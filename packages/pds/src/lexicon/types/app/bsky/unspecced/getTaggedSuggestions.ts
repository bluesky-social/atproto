/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'

export const id = 'app.bsky.unspecced.getTaggedSuggestions'

export interface QueryParams {}

export type InputSchema = undefined

export interface OutputSchema {
  suggestions: Suggestion[]
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

export interface Suggestion {
  $type?: $Type<'app.bsky.unspecced.getTaggedSuggestions', 'suggestion'>
  tag: string
  subjectType: 'actor' | 'feed' | (string & {})
  subject: string
}

export function isSuggestion<V>(v: V) {
  return is$typed(v, id, 'suggestion')
}

export function validateSuggestion(v: unknown) {
  return lexicons.validate(
    `${id}#suggestion`,
    v,
  ) as ValidationResult<Suggestion>
}

export function isValidSuggestion<V>(v: V): v is V & $Typed<Suggestion> {
  return isSuggestion(v) && validateSuggestion(v).success
}
