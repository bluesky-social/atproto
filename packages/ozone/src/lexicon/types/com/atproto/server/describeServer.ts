/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'

const is$typed = _is$typed,
  validate = _validate
const id = 'com.atproto.server.describeServer'

export interface QueryParams {}

export type InputSchema = undefined

export interface OutputSchema {
  /** If true, an invite code must be supplied to create an account on this instance. */
  inviteCodeRequired?: boolean
  /** If true, a phone verification token must be supplied to create an account on this instance. */
  phoneVerificationRequired?: boolean
  /** List of domain suffixes that can be used in account handles. */
  availableUserDomains: string[]
  links?: Links
  contact?: Contact
  did: string
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
  resetRouteRateLimits: () => Promise<void>
}
export type Handler<HA extends HandlerAuth = never> = (
  ctx: HandlerReqCtx<HA>,
) => Promise<HandlerOutput> | HandlerOutput

export interface Links {
  $type?: 'com.atproto.server.describeServer#links'
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

export interface Contact {
  $type?: 'com.atproto.server.describeServer#contact'
  email?: string
}

const hashContact = 'contact'

export function isContact<V>(v: V) {
  return is$typed(v, id, hashContact)
}

export function validateContact<V>(v: V) {
  return validate<Contact & V>(v, id, hashContact)
}
