/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'

export type Main =
  | 'com.atproto.report.reason#spam'
  | 'com.atproto.report.reason#other'
  | (string & {})

/** Moderation report reason: Spam. */
export const SPAM = 'com.atproto.report.reasonType#spam'
/** Moderation report reason: Other. */
export const OTHER = 'com.atproto.report.reasonType#other'
