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
import type * as AppBskyAgeassuranceDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.ageassurance.begin'

export type QueryParams = {}

export interface InputSchema {
  /** The user's email address to receive Age Assurance instructions. */
  email: string
  /** The user's preferred language for communication during the Age Assurance process. */
  language: string
  /** An ISO 3166-1 alpha-2 code of the user's location. */
  countryCode: string
  /** An optional ISO 3166-2 code of the user's region or state within the country. */
  regionCode?: string
}

export type OutputSchema = AppBskyAgeassuranceDefs.State

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
  error?:
    | 'InvalidEmail'
    | 'DidTooLong'
    | 'InvalidInitiation'
    | 'RegionNotSupported'
}

export type HandlerOutput = HandlerError | HandlerSuccess
