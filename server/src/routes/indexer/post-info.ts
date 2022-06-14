import express from 'express'
import { z } from 'zod'
import { schema } from '@adxp/common'
import * as util from '../../util.js'
import { ServerError } from '../../error.js'

const router = express.Router()

export const getPostInfoReq = z.object({
  did: z.string(),
  namespace: z.string(),
  tid: schema.repo.strToTid,
})
export type getPostInfoReq = z.infer<typeof getPostInfoReq>

router.get('/', async (req, res) => {
  const { did, namespace, tid } = util.checkReqBody(req.query, getPostInfoReq)
  const db = util.getDB(res)
  const post = await db.retrievePostInfo(tid.toString(), did, namespace)
  if (!post) {
    throw new ServerError(404, 'Could not find post')
  }
  res.status(200).send(post)
})

export default router
