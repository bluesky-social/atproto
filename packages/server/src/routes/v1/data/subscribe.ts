import express from 'express'
import { z } from 'zod'
<<<<<<< HEAD:packages/server/src/routes/data/subscribe.ts
import * as util from '../../util'
=======
import * as util from '../../../util.js'
>>>>>>> cab993c (WIP API branch squash):packages/server/src/routes/v1/data/subscribe.ts

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
