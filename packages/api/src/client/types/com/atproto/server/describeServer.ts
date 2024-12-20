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

export interface Links {
  $type?: $Type<'com.atproto.server.describeServer', 'links'>
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

export interface Contact {
  $type?: $Type<'com.atproto.server.describeServer', 'contact'>
  email?: string
}

const hashContact = 'contact'

export function isContact<V>(v: V) {
  return is$typed(v, id, hashContact)
}

export function validateContact<V>(v: V) {
  return validate<Contact & V>(v, id, hashContact)
}

export function isValidContact<V>(v: V) {
  return isValid<Contact>(v, id, hashContact)
}
