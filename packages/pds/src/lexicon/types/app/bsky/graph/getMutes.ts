/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { HandlerAuth } from '@atproto/xrpc-server'
import * as AppBskySystemDeclRef from '../system/declRef'

export interface QueryParams {
  limit?: number
  before?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  mutes: Mute[]
  [k: string]: unknown
}

export type HandlerInput = undefined

export interface HandlerSuccess {
  encoding: 'application/json'
  body: OutputSchema
}

export interface HandlerError {
  status: number
  message?: string
}

export type HandlerOutput = HandlerError | HandlerSuccess
export type Handler<HA extends HandlerAuth = never> = (ctx: {
  auth: HA
  params: QueryParams
  input: HandlerInput
  req: express.Request
  res: express.Response
}) => Promise<HandlerOutput> | HandlerOutput

export interface Mute {
  did: string
  declaration: AppBskySystemDeclRef.Main
  handle: string
  displayName?: string
  createdAt: string
  [k: string]: unknown
}

export function isMute(v: unknown): v is Mute {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.graph.getMutes#mute'
  )
}

export function validateMute(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.graph.getMutes#mute', v)
}
