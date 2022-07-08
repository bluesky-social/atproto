import express from 'express'
import { z } from 'zod'
import * as util from '../../util'

const router = express.Router()

export const accountInfoReq = z.object({
  did: z.string(),
})
export type AccountInfoReq = z.infer<typeof accountInfoReq>

router.get('/', async (req, res) => {
  const { did } = util.checkReqBody(req.query, accountInfoReq)
  const db = util.getDB(res)
  const accountInfo = await db.getAccountInfo(did)
  res.status(200).send(accountInfo)
})

export default router
