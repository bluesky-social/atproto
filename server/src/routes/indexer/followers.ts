import express from 'express'
import { z } from 'zod'
import { check } from '@bluesky-demo/common'
import * as util from '../../util.js'

const router = express.Router()

export const followersReq = z.object({
  user: z.string(),
})
export type FollowersReq = z.infer<typeof followersReq>

router.get('/', async (req, res) => {
  if (!check.is(req.query, followersReq)) {
    return res.status(400).send('Poorly formatted request')
  }
  const { user } = req.query
  const db = util.getDB(res)
  const followers = await db.listFollowers(user)
  res.status(200).send(followers)
})

export default router
