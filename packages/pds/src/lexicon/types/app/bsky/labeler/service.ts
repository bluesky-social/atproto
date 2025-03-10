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
import type * as AppBskyLabelerDefs from './defs.js'
import type * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs.js'
import type * as ComAtprotoModerationDefs from '../../../com/atproto/moderation/defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.labeler.service'

export interface Record {
  $type: 'app.bsky.labeler.service'
  policies: AppBskyLabelerDefs.LabelerPolicies
  labels?: $Typed<ComAtprotoLabelDefs.SelfLabels> | { $type: string }
  createdAt: string
  /** The set of report reason 'codes' which are in-scope for this service to review and action. These usually align to policy categories. If not defined (distinct from empty array), all reason types are allowed. */
  reasonTypes?: ComAtprotoModerationDefs.ReasonType[]
  /** The set of subject types (account, record, etc) this service accepts reports on. */
  subjectTypes?: ComAtprotoModerationDefs.SubjectType[]
  /** Set of record types (collection NSIDs) which can be reported to this service. If not defined (distinct from empty array), default is any record type. */
  subjectCollections?: string[]
  [k: string]: unknown
}

const hashRecord = 'main'

export function isRecord<V>(v: V) {
  return is$typed(v, id, hashRecord)
}

export function validateRecord<V>(v: V) {
  return validate<Record & V>(v, id, hashRecord, true)
}
