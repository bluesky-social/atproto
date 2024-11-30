/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as AppBskyActorDefs from '../../../app/bsky/actor/defs'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'

export interface ProfileViewBasic {
  did: string
  handle: string
  displayName?: string
  avatar?: string
  associated?: AppBskyActorDefs.ProfileAssociated
  viewer?: AppBskyActorDefs.ViewerState
  labels?: ComAtprotoLabelDefs.Label[]
  /** Set to true when the actor cannot actively participate in converations */
  chatDisabled?: boolean
  [k: string]: unknown
}

export function isProfileViewBasic(v: unknown): v is ProfileViewBasic {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'chat.bsky.actor.defs#profileViewBasic'
  )
}

export function validateProfileViewBasic(v: unknown): ValidationResult {
  return lexicons.validate('chat.bsky.actor.defs#profileViewBasic', v)
}
