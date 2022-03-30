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
  post_cid: z.string(), // @TODO: should this be a CID instead of a str?
})
export type Like = z.infer<typeof like>

export const schema = {
  post,
  like,
}
