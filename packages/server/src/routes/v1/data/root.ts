import express from 'express'
import { z } from 'zod'
<<<<<<< HEAD:packages/server/src/routes/data/root.ts
import { ServerError } from '../../error'
import * as util from '../../util'
=======
import { ServerError } from '../../../error.js'
import * as util from '../../../util.js'
>>>>>>> cab993c (WIP API branch squash):packages/server/src/routes/v1/data/root.ts

const router = express.Router()

export const getRootReq = z.object({
  did: z.string(),
})
export type GetRootReq = z.infer<typeof getRootReq>

router.get('/', async (req, res) => {
  const { did } = util.checkReqBody(req.query, getRootReq)
  const db = util.getDB(res)
  const root = await db.getRepoRoot(did)
  if (root === null) {
    throw new ServerError(404, `Could not find root for DID: ${did}`)
  }
  res.status(200).send({ root: root.toString() })
})

export default router
