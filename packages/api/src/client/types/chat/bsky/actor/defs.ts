/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskyActorDefs from '../../../app/bsky/actor/defs'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'

export const id = 'chat.bsky.actor.defs'

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

export function isProfileViewBasic<V>(v: V) {
  return is$typed(v, id, 'profileViewBasic')
}

export function validateProfileViewBasic(v: unknown) {
  return lexicons.validate(
    `${id}#profileViewBasic`,
    v,
  ) as ValidationResult<ProfileViewBasic>
}

export function isValidProfileViewBasic<V>(
  v: V,
): v is V & $Typed<ProfileViewBasic> {
  return isProfileViewBasic(v) && validateProfileViewBasic(v).success
}
