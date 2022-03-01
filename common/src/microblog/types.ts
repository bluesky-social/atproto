export type Follow = {
  username: string
  did: string
}

export type Post = {
  id: string // @TODO `tid`?
  author: string
  text: string
  time: string // ISO 8601
}

export type Like = {
  id: string
  post_id: string
  author: string
  time: string // ISO 8601
}
