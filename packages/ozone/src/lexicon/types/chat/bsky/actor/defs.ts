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
import type * as AppBskyActorDefs from '../../../app/bsky/actor/defs.js'
import type * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'chat.bsky.actor.defs'

export type MemberRole = 'owner' | 'standard' | (string & {})

export interface ProfileViewBasic {
  $type?: 'chat.bsky.actor.defs#profileViewBasic'
  did: string
  handle: string
  displayName?: string
  avatar?: string
  associated?: AppBskyActorDefs.ProfileAssociated
  viewer?: AppBskyActorDefs.ViewerState
  labels?: ComAtprotoLabelDefs.Label[]
  createdAt?: string
  /** Set to true when the actor cannot actively participate in conversations */
  chatDisabled?: boolean
  verification?: AppBskyActorDefs.VerificationState
  kind?:
    | $Typed<DirectConvoMember>
    | $Typed<GroupConvoMember>
    | $Typed<PastGroupConvoMember>
    | { $type: string }
}

const hashProfileViewBasic = 'profileViewBasic'

export function isProfileViewBasic<V>(v: V) {
  return is$typed(v, id, hashProfileViewBasic)
}

export function validateProfileViewBasic<V>(v: V) {
  return validate<ProfileViewBasic & V>(v, id, hashProfileViewBasic)
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. */
export interface DirectConvoMember {
  $type?: 'chat.bsky.actor.defs#directConvoMember'
}

const hashDirectConvoMember = 'directConvoMember'

export function isDirectConvoMember<V>(v: V) {
  return is$typed(v, id, hashDirectConvoMember)
}

export function validateDirectConvoMember<V>(v: V) {
  return validate<DirectConvoMember & V>(v, id, hashDirectConvoMember)
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. A current group convo member. */
export interface GroupConvoMember {
  $type?: 'chat.bsky.actor.defs#groupConvoMember'
  addedBy?: ProfileViewBasic
  role: MemberRole
}

const hashGroupConvoMember = 'groupConvoMember'

export function isGroupConvoMember<V>(v: V) {
  return is$typed(v, id, hashGroupConvoMember)
}

export function validateGroupConvoMember<V>(v: V) {
  return validate<GroupConvoMember & V>(v, id, hashGroupConvoMember)
}

/** [NOTE: This is under active development and should be considered unstable while this note is here]. A past group convo member. */
export interface PastGroupConvoMember {
  $type?: 'chat.bsky.actor.defs#pastGroupConvoMember'
}

const hashPastGroupConvoMember = 'pastGroupConvoMember'

export function isPastGroupConvoMember<V>(v: V) {
  return is$typed(v, id, hashPastGroupConvoMember)
}

export function validatePastGroupConvoMember<V>(v: V) {
  return validate<PastGroupConvoMember & V>(v, id, hashPastGroupConvoMember)
}
