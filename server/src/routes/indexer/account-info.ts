import express from 'express'
import { z } from 'zod'
import { check } from '@bluesky-demo/common'
import * as util from '../../util.js'

const router = express.Router()

export const accountInfoReq = z.object({
  did: z.string(),
})
export type AccountInfoReq = z.infer<typeof accountInfoReq>

router.get('/', async (req, res) => {
  console.log('HERE')
  if (!check.is(req.query, accountInfoReq)) {
    return res.status(400).send('Poorly formatted request')
  }
  const { did } = req.query
  const db = util.getDB(res)
  const accountInfo = await db.getAccountInfo(did)
  res.status(200).send(accountInfo)
})

export default router
