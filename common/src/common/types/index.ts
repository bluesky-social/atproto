export * as check from './check'

export type Follow = {
  username: string
  did: string
}

export type Post = {
  id: string
  author: string
  text: string
  time: string // ISO 8601
}
