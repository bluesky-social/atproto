import { z } from 'zod'
import * as t from '../common/types.js'

export const follow = z.object({
  username: z.string(),
  did: t.did,
})
export type Follow = z.infer<typeof follow>

export const post = z.object({
  tid: z.string(),
  author: z.string(),
  program: z.string(),
  text: z.string(),
  time: z.string(),
})
export type Post = z.infer<typeof post>

export const like = z.object({
  tid: z.string(),
  author: z.string(),
  program: z.string(),
  time: z.string(),
  post_tid: z.string(),
  post_author: z.string(),
  post_program: z.string(),
  post_cid: t.cid,
})
export type Like = z.infer<typeof like>
