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
import type * as ToolsOzoneModerationDefs from '../moderation/defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.verification.defs'

/** Verification data for the associated subject. */
export interface VerificationView {
  $type?: 'tools.ozone.verification.defs#verificationView'
  /** The user who issued this verification. */
  issuer: string
  /** The AT-URI of the verification record. */
  uri: string
  /** The subject of the verification. */
  subject: string
  /** Handle of the subject the verification applies to at the moment of verifying, which might not be the same at the time of viewing. The verification is only valid if the current handle matches the one at the time of verifying. */
  handle: string
  /** Display name of the subject the verification applies to at the moment of verifying, which might not be the same at the time of viewing. The verification is only valid if the current displayName matches the one at the time of verifying. */
  displayName: string
  /** Timestamp when the verification was created. */
  createdAt: string
  /** Describes the reason for revocation, also indicating that the verification is no longer valid. */
  revokeReason?: string
  /** Timestamp when the verification was revoked. */
  revokedAt?: string
  /** The user who revoked this verification. */
  revokedBy?: string
  subjectProfile?: { $type: string }
  issuerProfile?: { $type: string }
  subjectRepo?:
    | $Typed<ToolsOzoneModerationDefs.RepoViewDetail>
    | $Typed<ToolsOzoneModerationDefs.RepoViewNotFound>
    | { $type: string }
  issuerRepo?:
    | $Typed<ToolsOzoneModerationDefs.RepoViewDetail>
    | $Typed<ToolsOzoneModerationDefs.RepoViewNotFound>
    | { $type: string }
}

const hashVerificationView = 'verificationView'

export function isVerificationView<V>(v: V) {
  return is$typed(v, id, hashVerificationView)
}

export function validateVerificationView<V>(v: V) {
  return validate<VerificationView & V>(v, id, hashVerificationView)
}
