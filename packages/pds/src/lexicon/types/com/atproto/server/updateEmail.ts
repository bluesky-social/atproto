/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'

export const id = 'com.atproto.server.updateEmail'

export interface QueryParams {}

export interface InputSchema {
  email: string
  emailAuthFactor?: boolean
  /** Requires a token from com.atproto.sever.requestEmailUpdate if the account's email has been confirmed. */
  token?: string
}

export interface HandlerInput {
  encoding: 'application/json'
  body: InputSchema
}

export interface HandlerError {
  status: number
  message?: string
  error?: 'ExpiredToken' | 'InvalidToken' | 'TokenRequired'
}

export type HandlerOutput = HandlerError | void
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
