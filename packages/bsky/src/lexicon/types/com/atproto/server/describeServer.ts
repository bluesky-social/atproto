/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'

export const id = 'com.atproto.server.describeServer'

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
}
export type Handler<HA extends HandlerAuth = never> = (
  ctx: HandlerReqCtx<HA>,
) => Promise<HandlerOutput> | HandlerOutput

export interface Links {
  $type?: $Type<'com.atproto.server.describeServer', 'links'>
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

export interface Contact {
  $type?: $Type<'com.atproto.server.describeServer', 'contact'>
  email?: string
}

export function isContact<V>(v: V) {
  return is$typed(v, id, 'contact')
}

export function validateContact(v: unknown) {
  return lexicons.validate(`${id}#contact`, v) as ValidationResult<Contact>
}

export function isValidContact<V>(v: V): v is V & $Typed<Contact> {
  return isContact(v) && validateContact(v).success
}
