/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'

export interface Record {
  subject: string
  relationship:
    | 'verifiedBy'
    | 'employeeOf'
    | 'memberOf'
    | 'affiliatedWith'
    | 'countributorTo'
    | 'alumnusOf'
    | 'colleagueOf'
    | 'creatorOf'
    | 'founderOf'
    | 'relatedTo'
    | 'marriedTo'
    | 'friendOf'
    | 'nemesisOf'
    | (string & {})
  createdAt: string
  [k: string]: unknown
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'app.bsky.graph.vouch#main' ||
      v.$type === 'app.bsky.graph.vouch')
  )
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.graph.vouch#main', v)
}
