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
import type * as AppBskyEmbedExternal from '../embed/external.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.actor.status'

export interface Record {
  $type: 'app.bsky.actor.status'
  /** The status for the account. */
  status: 'app.bsky.actor.status#live' | (string & {})
  embed?: $Typed<AppBskyEmbedExternal.Main> | { $type: string }
  /** The duration of the status in minutes. Applications can choose to impose minimum and maximum limits. */
  durationMinutes?: number
  createdAt: string
  [k: string]: unknown
}

const hashRecord = 'main'

export function isRecord<V>(v: V) {
  return is$typed(v, id, hashRecord)
}

export function validateRecord<V>(v: V) {
  return validate<Record & V>(v, id, hashRecord, true)
}

/** Advertises an account as currently offering live content. */
export const LIVE = `${id}#live`
