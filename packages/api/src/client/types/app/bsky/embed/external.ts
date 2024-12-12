/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'

const id = 'app.bsky.embed.external'

/** A representation of some externally linked content (eg, a URL and 'card'), embedded in a Bluesky record (eg, a post). */
export interface Main {
  external: External
  [k: string]: unknown
}

export function isMain(
  v: unknown,
): v is Main & { $type: $Type<'app.bsky.embed.external', 'main'> } {
  return is$typed(v, id, 'main')
}

export function validateMain(v: unknown) {
  return lexicons.validate(`${id}#main`, v) as ValidationResult<Main>
}

export interface External {
  uri: string
  title: string
  description: string
  thumb?: BlobRef
  [k: string]: unknown
}

export function isExternal(
  v: unknown,
): v is External & { $type: $Type<'app.bsky.embed.external', 'external'> } {
  return is$typed(v, id, 'external')
}

export function validateExternal(v: unknown) {
  return lexicons.validate(`${id}#external`, v) as ValidationResult<External>
}

export interface View {
  external: ViewExternal
  [k: string]: unknown
}

export function isView(
  v: unknown,
): v is View & { $type: $Type<'app.bsky.embed.external', 'view'> } {
  return is$typed(v, id, 'view')
}

export function validateView(v: unknown) {
  return lexicons.validate(`${id}#view`, v) as ValidationResult<View>
}

export interface ViewExternal {
  uri: string
  title: string
  description: string
  thumb?: string
  [k: string]: unknown
}

export function isViewExternal(v: unknown): v is ViewExternal & {
  $type: $Type<'app.bsky.embed.external', 'viewExternal'>
} {
  return is$typed(v, id, 'viewExternal')
}

export function validateViewExternal(v: unknown) {
  return lexicons.validate(
    `${id}#viewExternal`,
    v,
  ) as ValidationResult<ViewExternal>
}
