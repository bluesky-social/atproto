import express from 'express'
import { z } from 'zod'
import { check } from '@bluesky-demo/common'
import * as util from '../../util.js'

const router = express.Router()

export const likeCountReq = z.object({
  author: z.string(),
  namespace: z.string(),
  tid: z.string(),
})
export type LikeCountReq = z.infer<typeof likeCountReq>

router.get('/likes', async (req, res) => {
  if (!check.is(req.query, likeCountReq)) {
    return res.status(400).send('Poorly formatted request')
  }
  const { author, namespace, tid } = req.query
  const db = util.getDB(res)
  const count = await db.likeCount(author, namespace, tid)
  res.status(200).send({ count })
})

export default router
