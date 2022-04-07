import { z } from 'zod'
import { schema as repo } from '../repo/types.js'

const post = z.object({
  tid: repo.strToTid,
  author: z.string(),
  namespace: z.string(),
  text: z.string(),
  time: z.string(),
})
export type Post = z.infer<typeof post>

// @TODO move flatten methods to ipld store?
export const flattenPost = (like: Post): Record<string, string | number> => {
  return {
    tid: like.tid.toString(),
    author: like.author,
    namespace: like.namespace,
    text: like.text,
    time: like.time,
  }
}

const like = z.object({
  tid: repo.strToTid,
  author: z.string(),
  namespace: z.string(),
  time: z.string(),
  post_tid: repo.strToTid,
  post_author: z.string(),
  post_namespace: z.string(),
})
export type Like = z.infer<typeof like>

export const flattenLike = (like: Like): Record<string, string | number> => {
  return {
    tid: like.tid.toString(),
    author: like.author,
    namespace: like.namespace,
    time: like.time,
    post_tid: like.post_tid.toString(),
    post_author: like.post_author,
    post_namespace: like.post_namespace,
  }
}

const timelinePost = z.object({
  tid: repo.strToTid,
  author_did: z.string(),
  author_name: z.string(),
  text: z.string(),
  time: z.string(),
  likes: z.number(),
})
export type TimelinePost = z.infer<typeof timelinePost>

const timeline = z.array(timelinePost)
export type Timeline = z.infer<typeof timeline>

const accountInfo = z.object({
  did: z.string(),
  username: z.string(),
  postCount: z.number(),
  followerCount: z.number(),
  followCount: z.number(),
})
export type AccountInfo = z.infer<typeof accountInfo>

export const schema = {
  post,
  like,
  timelinePost,
  timeline,
  accountInfo,
}
