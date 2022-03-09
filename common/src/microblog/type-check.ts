import * as t from './types.js'

export const isPost = (obj: unknown): obj is t.Post => {
  return t.post.safeParse(obj).success
}

export const assurePost = (obj: unknown): t.Post => {
  return t.post.parse(obj)
}

export const isFollow = (obj: unknown): obj is t.Follow => {
  return t.follow.safeParse(obj).success
}

export const assureFollow = (obj: unknown): t.Follow => {
  return t.follow.parse(obj)
}

export const isLike = (obj: unknown): obj is t.Like => {
  return t.like.safeParse(obj).success
}

export const assureLike = (obj: unknown): t.Like => {
  return t.like.parse(obj)
}
