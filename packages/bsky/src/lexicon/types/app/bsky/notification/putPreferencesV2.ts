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
import type * as AppBskyNotificationDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.notification.putPreferencesV2'

export type QueryParams = {}

export interface InputSchema {
  chat?: AppBskyNotificationDefs.ChatPreference
  follow?: AppBskyNotificationDefs.FilterablePreference
  like?: AppBskyNotificationDefs.FilterablePreference
  likeViaRepost?: AppBskyNotificationDefs.FilterablePreference
  mention?: AppBskyNotificationDefs.FilterablePreference
  quote?: AppBskyNotificationDefs.FilterablePreference
  reply?: AppBskyNotificationDefs.FilterablePreference
  repost?: AppBskyNotificationDefs.FilterablePreference
  repostViaRepost?: AppBskyNotificationDefs.FilterablePreference
  starterpackJoined?: AppBskyNotificationDefs.Preference
  subscribedPost?: AppBskyNotificationDefs.Preference
  unverified?: AppBskyNotificationDefs.Preference
  verified?: AppBskyNotificationDefs.Preference
}

export interface OutputSchema {
  preferences: AppBskyNotificationDefs.Preferences
}

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
}

export type HandlerOutput = HandlerError | HandlerSuccess
