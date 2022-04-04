import express from 'express'
import { z } from 'zod'
import { check } from '@bluesky-demo/common'
import * as util from '../../util.js'
import { ServerError } from '../../error.js'

const router = express.Router()

export const getTimelineReq = z.object({
  user: z.string(),
  count: z.string(),
  from: z.string().optional(),
})
export type GetTimelineReq = z.infer<typeof getTimelineReq>

router.get('/', async (req, res) => {
  if (!check.is(req.query, getTimelineReq)) {
    return res.status(400).send('Poorly formatted request')
  }
  const { user, count, from } = req.query
  // @TODO: do this with zod. also in list posts & list likes
  const countParsed = parseInt(count)
  if (isNaN(countParsed)) {
    throw new ServerError(
      400,
      'Poorly formatted request: `count` is not a number',
    )
  }
  const db = util.getDB(res)
  const timeline = await db.retrieveTimeline(user, countParsed, from)
  res.status(200).send(timeline)
})

export default router
