/**
 * GENERATED CODE - DO NOT MODIFY
 */
import * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef'

export interface Record {
  text: string
  entities?: Entity[]
  reply?: ReplyRef
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
