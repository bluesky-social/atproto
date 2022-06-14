import express from 'express'
import { z } from 'zod'
import { schema } from '@adxp/common'
import * as util from '../../util.js'

const router = express.Router()

export const getTimelineReq = z.object({
  user: z.string(),
  count: schema.common.strToInt,
  from: schema.repo.strToTid.optional(),
})
export type GetTimelineReq = z.infer<typeof getTimelineReq>

router.get('/', async (req, res) => {
  const { user, count, from } = util.checkReqBody(req.query, getTimelineReq)
  const db = util.getDB(res)
  const timeline = await db.retrieveTimeline(user, count, from?.toString())
  res.status(200).send(timeline)
})

export default router
