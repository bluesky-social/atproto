/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.hosting.getAccountHistory'

export type QueryParams = {
  did: string
  events?:
    | 'accountCreated'
    | 'emailUpdated'
    | 'emailConfirmed'
    | 'passwordUpdated'
    | 'handleUpdated'
    | (string & {})[]
  cursor?: string
  limit?: number
}
export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  events: Event[]
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

export interface Event {
  $type?: 'tools.ozone.hosting.getAccountHistory#event'
  details:
    | $Typed<AccountCreated>
    | $Typed<EmailUpdated>
    | $Typed<EmailConfirmed>
    | $Typed<PasswordUpdated>
    | $Typed<HandleUpdated>
    | { $type: string }
  createdBy: string
  createdAt: string
}

const hashEvent = 'event'

export function isEvent<V>(v: V) {
  return is$typed(v, id, hashEvent)
}

export function validateEvent<V>(v: V) {
  return validate<Event & V>(v, id, hashEvent)
}

export interface AccountCreated {
  $type?: 'tools.ozone.hosting.getAccountHistory#accountCreated'
  email?: string
  handle?: string
}

const hashAccountCreated = 'accountCreated'

export function isAccountCreated<V>(v: V) {
  return is$typed(v, id, hashAccountCreated)
}

export function validateAccountCreated<V>(v: V) {
  return validate<AccountCreated & V>(v, id, hashAccountCreated)
}

export interface EmailUpdated {
  $type?: 'tools.ozone.hosting.getAccountHistory#emailUpdated'
  email: string
}

const hashEmailUpdated = 'emailUpdated'

export function isEmailUpdated<V>(v: V) {
  return is$typed(v, id, hashEmailUpdated)
}

export function validateEmailUpdated<V>(v: V) {
  return validate<EmailUpdated & V>(v, id, hashEmailUpdated)
}

export interface EmailConfirmed {
  $type?: 'tools.ozone.hosting.getAccountHistory#emailConfirmed'
  email: string
}

const hashEmailConfirmed = 'emailConfirmed'

export function isEmailConfirmed<V>(v: V) {
  return is$typed(v, id, hashEmailConfirmed)
}

export function validateEmailConfirmed<V>(v: V) {
  return validate<EmailConfirmed & V>(v, id, hashEmailConfirmed)
}

export interface PasswordUpdated {
  $type?: 'tools.ozone.hosting.getAccountHistory#passwordUpdated'
}

const hashPasswordUpdated = 'passwordUpdated'

export function isPasswordUpdated<V>(v: V) {
  return is$typed(v, id, hashPasswordUpdated)
}

export function validatePasswordUpdated<V>(v: V) {
  return validate<PasswordUpdated & V>(v, id, hashPasswordUpdated)
}

export interface HandleUpdated {
  $type?: 'tools.ozone.hosting.getAccountHistory#handleUpdated'
  handle: string
}

const hashHandleUpdated = 'handleUpdated'

export function isHandleUpdated<V>(v: V) {
  return is$typed(v, id, hashHandleUpdated)
}

export function validateHandleUpdated<V>(v: V) {
  return validate<HandleUpdated & V>(v, id, hashHandleUpdated)
}
