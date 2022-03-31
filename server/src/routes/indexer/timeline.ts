import express from 'express'
import { z } from 'zod'
import { check } from '@bluesky-demo/common'
import * as util from '../../util.js'

const router = express.Router()

export const getTimelineReq = z.object({
  user: z.string(),
})
export type GetTimelineReq = z.infer<typeof getTimelineReq>

router.get('/', async (req, res) => {
  if (!check.is(req.query, getTimelineReq)) {
    return res.status(400).send('Poorly formatted request')
  }
  const { user } = req.query
  const db = util.getDB(res)
  const timeline = await db.retrieveTimeline(user)
  res.status(200).send(timeline)
})

export default router
