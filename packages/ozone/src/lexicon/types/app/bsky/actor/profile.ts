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
import type * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'
import type * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef'

const is$typed = _is$typed,
  isValid = _isValid,
  validate = _validate
const id = 'app.bsky.actor.profile'

export interface Record {
  $type?: $Type<'app.bsky.actor.profile', 'main'>
  displayName?: string
  /** Free-form profile description text. */
  description?: string
  /** Small image to be displayed next to posts from account. AKA, 'profile picture' */
  avatar?: BlobRef
  /** Larger horizontal image to display behind profile view. */
  banner?: BlobRef
  labels?: $Typed<ComAtprotoLabelDefs.SelfLabels> | { $type: string }
  joinedViaStarterPack?: ComAtprotoRepoStrongRef.Main
  pinnedPost?: ComAtprotoRepoStrongRef.Main
  createdAt?: string
  [k: string]: unknown
}

const hashRecord = 'main'

export function isRecord<V>(v: V) {
  return is$typed(v, id, hashRecord)
}

export function validateRecord<V>(v: V) {
  return validate<Record & V>(v, id, hashRecord)
}

export function isValidRecord<V>(v: V) {
  return isValid<Record>(v, id, hashRecord, true)
}
