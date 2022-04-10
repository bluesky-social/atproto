import express from 'express'
import { z } from 'zod'
import { schema } from '@bluesky/common'
import * as util from '../../util.js'

const router = express.Router()

export const likeCountReq = z.object({
  author: z.string(),
  namespace: z.string(),
  tid: schema.repo.strToTid,
})
export type LikeCountReq = z.infer<typeof likeCountReq>

router.get('/likes', async (req, res) => {
  const { author, namespace, tid } = util.checkReqBody(req.query, likeCountReq)
  const db = util.getDB(res)
  const count = await db.likeCount(author, namespace, tid.toString())
  res.status(200).send({ count })
})

export default router
