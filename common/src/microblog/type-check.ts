import { assure, isCID, isObject, isString } from '../common/type-check.js'
import { Post, Follow, Like } from './types.js'

export const isPost = (obj: unknown): obj is Post => {
  return (
    isObject(obj) &&
    isString(obj.tid) &&
    isString(obj.author) &&
    isString(obj.program) &&
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
    isString(obj.tid) &&
    isString(obj.program) &&
    isString(obj.author) &&
    isString(obj.time) &&
    isString(obj.post_tid) &&
    isString(obj.post_author) &&
    isString(obj.post_program) &&
    isCID(obj.post_cid)
  )
}

export const assureLike = (obj: unknown): Like => {
  return assure(obj, 'Like', isLike)
}
