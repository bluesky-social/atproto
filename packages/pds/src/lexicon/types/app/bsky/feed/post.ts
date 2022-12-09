/**
 * GENERATED CODE - DO NOT MODIFY
 */
import * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef'
import * as ComAtprotoEmbedImage from '../../../com/atproto/embed/image'
import * as ComAtprotoEmbedExternal from '../../../com/atproto/embed/external'

export interface Record {
  text: string
  entities?: Entity[]
  reply?: ReplyRef
  embeds?: Images | External | { $type: string; [k: string]: unknown }
  createdAt: string
  [k: string]: unknown
}

export interface ReplyRef {
  root: ComAtprotoRepoStrongRef.Main
  parent: ComAtprotoRepoStrongRef.Main
  [k: string]: unknown
}

export interface Entity {
  index: TextSlice
  /** Expected values are 'mention', 'hashtag', and 'link'. */
  type: string
  value: string
  [k: string]: unknown
}

export interface TextSlice {
  start: number
  end: number
  [k: string]: unknown
}

export interface Images {
  images: ComAtprotoEmbedImage.Main[]
  [k: string]: unknown
}

export interface External {
  external: ComAtprotoEmbedExternal.Main
  [k: string]: unknown
}
