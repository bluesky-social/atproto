/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import {
  isValid as _isValid,
  validate as _validate,
} from '../../../../lexicons'
import { $Type, $Typed, is$typed as _is$typed, OmitKey } from '../../../../util'
import type * as AppBskyActorDefs from '../../../app/bsky/actor/defs'
import type * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'

const is$typed = _is$typed,
  isValid = _isValid,
  validate = _validate
const id = 'chat.bsky.actor.defs'

export interface ProfileViewBasic {
  $type?: $Type<'chat.bsky.actor.defs', 'profileViewBasic'>
  did: string
  handle: string
  displayName?: string
  avatar?: string
  associated?: AppBskyActorDefs.ProfileAssociated
  viewer?: AppBskyActorDefs.ViewerState
  labels?: ComAtprotoLabelDefs.Label[]
  /** Set to true when the actor cannot actively participate in converations */
  chatDisabled?: boolean
}

const hashProfileViewBasic = 'profileViewBasic'

export function isProfileViewBasic<V>(v: V) {
  return is$typed(v, id, hashProfileViewBasic)
}

export function validateProfileViewBasic<V>(v: V) {
  return validate<ProfileViewBasic & V>(v, id, hashProfileViewBasic)
}

export function isValidProfileViewBasic<V>(v: V) {
  return isValid<ProfileViewBasic>(v, id, hashProfileViewBasic)
}
