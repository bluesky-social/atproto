import { CID } from 'multiformats'

export type Follow = {
  username: string
  did: string
}

export type Post = {
  tid: string
  author: string
  program: string
  text: string
  time: string // ISO 8601
}

export type Like = {
  tid: string
  program: string
  author: string
  time: string // ISO 8601
  post_tid: string
  post_author: string
  post_program: string
  post_cid: CID
}
