/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'

export const id = 'chat.bsky.moderation.getActorMetadata'

export interface QueryParams {
  actor: string
}

export type InputSchema = undefined

export interface OutputSchema {
  day: Metadata
  month: Metadata
  all: Metadata
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

export interface Metadata {
  $type?: $Type<'chat.bsky.moderation.getActorMetadata', 'metadata'>
  messagesSent: number
  messagesReceived: number
  convos: number
  convosStarted: number
}

export function isMetadata<V>(v: V) {
  return is$typed(v, id, 'metadata')
}

export function validateMetadata(v: unknown) {
  return lexicons.validate(`${id}#metadata`, v) as ValidationResult<Metadata>
}

export function isValidMetadata<V>(v: V): v is V & $Typed<Metadata> {
  return isMetadata(v) && validateMetadata(v).success
}
