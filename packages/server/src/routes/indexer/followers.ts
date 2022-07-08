import express from 'express'
import { z } from 'zod'
import * as util from '../../util'

const router = express.Router()

export const followersReq = z.object({
  user: z.string(),
})
export type FollowersReq = z.infer<typeof followersReq>

router.get('/', async (req, res) => {
  const { user } = util.checkReqBody(req.query, followersReq)
  const db = util.getDB(res)
  const followers = await db.listFollowers(user)
  res.status(200).send(followers)
})

export default router
