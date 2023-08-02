/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../lexicons'
import { isObj, hasProp } from '../../../util'
import { CID } from 'multiformats/cid'
import * as AppBskyRichtextFacet from '../../app/bsky/richtext/facet'
import * as ComAtprotoRepoStrongRef from '../../com/atproto/repo/strongRef'
import * as AppBskyEmbedImages from '../../app/bsky/embed/images'
import * as AppBskyEmbedExternal from '../../app/bsky/embed/external'
import * as AppBskyEmbedRecord from '../../app/bsky/embed/record'
import * as AppBskyEmbedRecordWithMedia from '../../app/bsky/embed/recordWithMedia'

export interface Record {
  text: string
  facets?: AppBskyRichtextFacet.Main[]
  subject?: ComAtprotoRepoStrongRef.Main
  embed?:
    | AppBskyEmbedImages.Main
    | AppBskyEmbedExternal.Main
    | AppBskyEmbedRecord.Main
    | AppBskyEmbedRecordWithMedia.Main
    | { $type: string; [k: string]: unknown }
  langs?: string[]
  createdAt: string
  [k: string]: unknown
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'social.waverly.miniblog#main' ||
      v.$type === 'social.waverly.miniblog')
  )
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate('social.waverly.miniblog#main', v)
}
