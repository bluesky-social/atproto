import { z } from 'zod'

const post = z.object({
  tid: z.string(),
  author: z.string(),
  program: z.string(),
  text: z.string(),
  time: z.string(),
})
export type Post = z.infer<typeof post>

const like = z.object({
  tid: z.string(),
  author: z.string(),
  program: z.string(),
  time: z.string(),
  post_tid: z.string(),
  post_author: z.string(),
  post_program: z.string(),
})
export type Like = z.infer<typeof like>

const timelinePost = z.object({
  tid: z.string(),
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
