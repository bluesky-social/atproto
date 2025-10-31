/**
 * GENERATED CODE - DO NOT MODIFY
 */
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
const id = 'com.atproto.server.createAppPassword'

export type QueryParams = {}

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

export type HandlerOutput = HandlerError | HandlerSuccess

export interface AppPassword {
  $type?: 'com.atproto.server.createAppPassword#appPassword'
  name: string
  password: string
  createdAt: string
  privileged?: boolean
}

const hashAppPassword = 'appPassword'

export function isAppPassword<V>(v: V) {
  return is$typed(v, id, hashAppPassword)
}

export function validateAppPassword<V>(v: V) {
  return validate<AppPassword & V>(v, id, hashAppPassword)
}
