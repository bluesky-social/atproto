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
import type * as AppBskyUnspeccedDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.unspecced.getTrendingTopics'

export type QueryParams = {
  /** DID of the account making the request (not included for public/unauthenticated queries). Used to boost followed accounts in ranking. */
  viewer?: string
  limit: number
}
export type InputSchema = undefined

export interface OutputSchema {
  topics: AppBskyUnspeccedDefs.TrendingTopic[]
  suggested: AppBskyUnspeccedDefs.TrendingTopic[]
}

export type HandlerInput = void

export interface HandlerSuccess {
  encoding: 'application/json'
  body: OutputSchema
  headers?: { [key: string]: string }
}

export interface HandlerError {
  status: number
  message?: string
}

export type HandlerOutput = HandlerError | HandlerSuccess
