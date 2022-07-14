import express from 'express'
import { z } from 'zod'
import * as util from '../../util.js'

const router = express.Router()

export const subscribeReq = z.object({
  did: z.string(),
  host: z.string(),
})
export type subscribeReq = z.infer<typeof subscribeReq>

router.post('/', async (req, res) => {
  const { did, host } = util.checkReqBody(req.body, subscribeReq)
  const db = util.getDB(res)
  await db.createSubscription(host, did)
  // do an initial push
  const repo = await util.loadRepo(res, did)
  await repo.push(host)
  res.status(200).send()
})

export default router
