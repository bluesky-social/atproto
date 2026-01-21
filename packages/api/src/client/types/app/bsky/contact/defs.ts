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
import type * as AppBskyActorDefs from '../actor/defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.contact.defs'

/** Associates a profile with the positional index of the contact import input in the call to `app.bsky.contact.importContacts`, so clients can know which phone caused a particular match. */
export interface MatchAndContactIndex {
  $type?: 'app.bsky.contact.defs#matchAndContactIndex'
  match: AppBskyActorDefs.ProfileView
  /** The index of this match in the import contact input. */
  contactIndex: number
}

const hashMatchAndContactIndex = 'matchAndContactIndex'

export function isMatchAndContactIndex<V>(v: V) {
  return is$typed(v, id, hashMatchAndContactIndex)
}

export function validateMatchAndContactIndex<V>(v: V) {
  return validate<MatchAndContactIndex & V>(v, id, hashMatchAndContactIndex)
}

export interface SyncStatus {
  $type?: 'app.bsky.contact.defs#syncStatus'
  /** Last date when contacts where imported. */
  syncedAt: string
  /** Number of existing contact matches resulting of the user imports and of their imported contacts having imported the user. Matches stop being counted when the user either follows the matched contact or dismisses the match. */
  matchesCount: number
}

const hashSyncStatus = 'syncStatus'

export function isSyncStatus<V>(v: V) {
  return is$typed(v, id, hashSyncStatus)
}

export function validateSyncStatus<V>(v: V) {
  return validate<SyncStatus & V>(v, id, hashSyncStatus)
}

/** A stash object to be sent via bsync representing a notification to be created. */
export interface Notification {
  $type?: 'app.bsky.contact.defs#notification'
  /** The DID of who this notification comes from. */
  from: string
  /** The DID of who this notification should go to. */
  to: string
}

const hashNotification = 'notification'

export function isNotification<V>(v: V) {
  return is$typed(v, id, hashNotification)
}

export function validateNotification<V>(v: V) {
  return validate<Notification & V>(v, id, hashNotification)
}
