/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'

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
  [k: string]: unknown
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
  privacyPolicy?: string
  termsOfService?: string
  [k: string]: unknown
}

export function isLinks(
  v: unknown,
): v is Links & { $type: $Type<'com.atproto.server.describeServer', 'links'> } {
  return is$typed(v, id, 'links')
}

export function validateLinks(v: unknown) {
  return lexicons.validate(`${id}#links`, v) as ValidationResult<Links>
}

export interface Contact {
  email?: string
  [k: string]: unknown
}

export function isContact(v: unknown): v is Contact & {
  $type: $Type<'com.atproto.server.describeServer', 'contact'>
} {
  return is$typed(v, id, 'contact')
}

export function validateContact(v: unknown) {
  return lexicons.validate(`${id}#contact`, v) as ValidationResult<Contact>
}
