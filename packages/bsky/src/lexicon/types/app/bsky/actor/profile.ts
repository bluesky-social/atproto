/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'
import * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef'

export const id = 'app.bsky.actor.profile'

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

export function isRecord<V>(v: V) {
  return is$typed(v, id, 'main')
}

export function validateRecord(v: unknown) {
  return lexicons.validate(`${id}#main`, v) as ValidationResult<Record>
}

export function isValidRecord<V>(v: V): v is V & $Typed<Record> {
  return isRecord(v) && validateRecord(v).success
}
