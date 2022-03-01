import { assure, isObject, isString } from '../common/type-check.js'
import { Post, Follow, Like } from './types.js'

export const isPost = (obj: unknown): obj is Post => {
  return (
    isObject(obj) &&
    isString(obj.id) &&
    isString(obj.author) &&
    isString(obj.text) &&
    isString(obj.time)
  )
}

export const assurePost = (obj: unknown): Post => {
  return assure(obj, 'Post', isPost)
}

export const isFollow = (obj: unknown): obj is Follow => {
  return isObject(obj) && isString(obj.username) && isString(obj.did)
}

export const assureFollow = (obj: unknown): Follow => {
  return assure(obj, 'Follow', isFollow)
}

export const isLike = (obj: unknown): obj is Like => {
  return (
    isObject(obj) &&
    isString(obj.id) &&
    isString(obj.post_id) &&
    isString(obj.author) &&
    isString(obj.time)
  )
}

export const assureLike = (obj: unknown): Like => {
  return assure(obj, 'Like', isLike)
}
