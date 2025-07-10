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
import type * as ComAtprotoIdentityDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'com.atproto.identity.refreshIdentity'

export type QueryParams = {}

export interface InputSchema {
  identifier: string
}

export type OutputSchema = ComAtprotoIdentityDefs.IdentityInfo

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
  error?: 'HandleNotFound' | 'DidNotFound' | 'DidDeactivated'
}

export type HandlerOutput = HandlerError | HandlerSuccess
