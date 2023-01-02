/**
 * GENERATED CODE - DO NOT MODIFY
 */
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
