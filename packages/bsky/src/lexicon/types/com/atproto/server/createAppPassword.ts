/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'

export const id = 'com.atproto.server.createAppPassword'

export interface QueryParams {}

export interface InputSchema {
  /** A short name for the App Password, to help distinguish them. */
  name: string
  /** If an app password has 'privileged' access to possibly sensitive account state. Meant for use with trusted clients. */
  privileged?: boolean
}

export type OutputSchema = AppPassword

export interface HandlerInput {
  encoding: 'application/json'
  body: InputSchema
}

export interface HandlerSuccess {
  encoding: 'application/json'
  body: OutputSchema
  headers?: { [key: string]: string }
}

export interface HandlerError {
  status: number
  message?: string
  error?: 'AccountTakedown'
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

export interface AppPassword {
  $type?: $Type<'com.atproto.server.createAppPassword', 'appPassword'>
  name: string
  password: string
  createdAt: string
  privileged?: boolean
}

export function isAppPassword<V>(v: V) {
  return is$typed(v, id, 'appPassword')
}

export function validateAppPassword(v: unknown) {
  return lexicons.validate(
    `${id}#appPassword`,
    v,
  ) as ValidationResult<AppPassword>
}

export function isValidAppPassword<V>(v: V): v is V & $Typed<AppPassword> {
  return isAppPassword(v) && validateAppPassword(v).success
}
