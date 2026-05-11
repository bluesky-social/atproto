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
const id = 'app.sokaa.actor.defs'

/** Minimal actor information, used when embedding author info in post views. */
export interface ProfileViewBasic {
  $type?: 'app.sokaa.actor.defs#profileViewBasic'
  did: string
  handle: string
  displayName?: string
  /** CDN URL of the avatar image. */
  avatar?: string
}

const hashProfileViewBasic = 'profileViewBasic'

export function isProfileViewBasic<V>(v: V) {
  return is$typed(v, id, hashProfileViewBasic)
}

export function validateProfileViewBasic<V>(v: V) {
  return validate<ProfileViewBasic & V>(v, id, hashProfileViewBasic)
}

/** Full profile view, returned by app.sokaa.actor.getProfile. */
export interface ProfileView {
  $type?: 'app.sokaa.actor.defs#profileView'
  did: string
  handle: string
  displayName?: string
  description?: string
  avatar?: string
  banner?: string
  website?: string
  followersCount?: number
  followsCount?: number
  postsCount?: number
  viewer?: ViewerState
  indexedAt?: string
}

const hashProfileView = 'profileView'

export function isProfileView<V>(v: V) {
  return is$typed(v, id, hashProfileView)
}

export function validateProfileView<V>(v: V) {
  return validate<ProfileView & V>(v, id, hashProfileView)
}

/** Authenticated viewer's relationship to this actor. */
export interface ViewerState {
  $type?: 'app.sokaa.actor.defs#viewerState'
  /** AT-URI of the viewer's follow record for this actor, if they follow them. */
  following?: string
  /** AT-URI of this actor's follow record for the viewer, if they follow back. */
  followedBy?: string
}

const hashViewerState = 'viewerState'

export function isViewerState<V>(v: V) {
  return is$typed(v, id, hashViewerState)
}

export function validateViewerState<V>(v: V) {
  return validate<ViewerState & V>(v, id, hashViewerState)
}
