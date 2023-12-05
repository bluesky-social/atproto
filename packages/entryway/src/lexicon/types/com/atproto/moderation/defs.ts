/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'

export type ReasonType =
  | 'com.atproto.moderation.defs#reasonSpam'
  | 'com.atproto.moderation.defs#reasonViolation'
  | 'com.atproto.moderation.defs#reasonMisleading'
  | 'com.atproto.moderation.defs#reasonSexual'
  | 'com.atproto.moderation.defs#reasonRude'
  | 'com.atproto.moderation.defs#reasonOther'
  | (string & {})

/** Spam: frequent unwanted promotion, replies, mentions */
export const REASONSPAM = 'com.atproto.moderation.defs#reasonSpam'
/** Direct violation of server rules, laws, terms of service */
export const REASONVIOLATION = 'com.atproto.moderation.defs#reasonViolation'
/** Misleading identity, affiliation, or content */
export const REASONMISLEADING = 'com.atproto.moderation.defs#reasonMisleading'
/** Unwanted or mislabeled sexual content */
export const REASONSEXUAL = 'com.atproto.moderation.defs#reasonSexual'
/** Rude, harassing, explicit, or otherwise unwelcoming behavior */
export const REASONRUDE = 'com.atproto.moderation.defs#reasonRude'
/** Other: reports not falling under another report category */
export const REASONOTHER = 'com.atproto.moderation.defs#reasonOther'
