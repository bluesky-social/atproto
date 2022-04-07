import express from 'express'
import { z } from 'zod'
import * as util from '../../util.js'

const router = express.Router()

export const getRootReq = z.object({
  did: z.string(),
})
export type GetRootReq = z.infer<typeof getRootReq>

router.get('/', async (req, res) => {
  const { did } = util.checkReqBody(req.query, getRootReq)
  const db = util.getDB(res)
  const root = await db.getRepoRoot(did)
  res.status(200).send({ root })
})

export default router
