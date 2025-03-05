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
const id = 'com.atproto.moderation.defs'

export type ReasonType =
  | 'com.atproto.moderation.defs#reasonSpam'
  | 'com.atproto.moderation.defs#reasonViolation'
  | 'com.atproto.moderation.defs#reasonMisleading'
  | 'com.atproto.moderation.defs#reasonSexual'
  | 'com.atproto.moderation.defs#reasonRude'
  | 'com.atproto.moderation.defs#reasonOther'
  | 'com.atproto.moderation.defs#reasonAppeal'
  | (string & {})

/** Spam: frequent unwanted promotion, replies, mentions */
export const REASONSPAM = `${id}#reasonSpam`
/** Direct violation of server rules, laws, terms of service */
export const REASONVIOLATION = `${id}#reasonViolation`
/** Misleading identity, affiliation, or content */
export const REASONMISLEADING = `${id}#reasonMisleading`
/** Unwanted or mislabeled sexual content */
export const REASONSEXUAL = `${id}#reasonSexual`
/** Rude, harassing, explicit, or otherwise unwelcoming behavior */
export const REASONRUDE = `${id}#reasonRude`
/** Other: reports not falling under another report category */
export const REASONOTHER = `${id}#reasonOther`
/** Appeal: appeal a previously taken moderation action */
export const REASONAPPEAL = `${id}#reasonAppeal`

/** Tag describing a type of subject that might be reported. */
export type SubjectType = 'account' | 'record' | 'chat' | (string & {})
