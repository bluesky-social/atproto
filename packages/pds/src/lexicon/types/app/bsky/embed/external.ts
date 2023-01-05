/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'

export interface Main {
  external: External
  [k: string]: unknown
}

export function isMain(v: unknown): v is Main {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'app.bsky.embed.external#main' ||
      v.$type === 'app.bsky.embed.external')
  )
}

export function validateMain(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.embed.external#main', v)
}

export interface External {
  uri: string
  title: string
  description: string
  thumb?: { cid: string; mimeType: string; [k: string]: unknown }
  [k: string]: unknown
}

export function isExternal(v: unknown): v is External {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.embed.external#external'
  )
}

export function validateExternal(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.embed.external#external', v)
}

export interface Presented {
  external: PresentedExternal
  [k: string]: unknown
}

export function isPresented(v: unknown): v is Presented {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.embed.external#presented'
  )
}

export function validatePresented(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.embed.external#presented', v)
}

export interface PresentedExternal {
  uri: string
  title: string
  description: string
  thumb?: string
  [k: string]: unknown
}

export function isPresentedExternal(v: unknown): v is PresentedExternal {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.embed.external#presentedExternal'
  )
}

export function validatePresentedExternal(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.embed.external#presentedExternal', v)
}
