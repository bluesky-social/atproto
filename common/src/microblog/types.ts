import { z } from 'zod'
import { schema as common } from '../common/types.js'

const follow = z.object({
  username: z.string(),
  did: common.did,
})
export type Follow = z.infer<typeof follow>

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
  post_cid: common.cid,
})
export type Like = z.infer<typeof like>

export const schema = {
  follow,
  post,
  like,
}
