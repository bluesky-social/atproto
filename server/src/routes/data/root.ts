import express from 'express'
import { z } from 'zod'
import { check } from '@bluesky-demo/common'
import * as util from '../../util.js'

const router = express.Router()

export const getRootReq = z.object({
  did: z.string(),
})
export type GetRootReq = z.infer<typeof getRootReq>

router.get('/', async (req, res) => {
  if (!check.is(req.query, getRootReq)) {
    return res.status(400).send('Poorly formatted request')
  }
  const db = util.getDB(res)
  const root = await db.getRepoRoot(req.query.did)
  res.status(200).send({ root })
})

export default router
