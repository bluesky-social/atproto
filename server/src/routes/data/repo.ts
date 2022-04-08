import express from 'express'
import { z } from 'zod'
import * as util from '../../util.js'
import { Repo, schema } from '@bluesky-demo/common'

const router = express.Router()

export const getRepoReq = z.object({
  did: z.string(),
  from: schema.common.strToCid.optional(),
})
export type GetRepoReq = z.infer<typeof getRepoReq>

router.get('/', async (req, res) => {
  const query = util.checkReqBody(req.query, getRepoReq)
  const { did, from = null } = query
  const repo = await util.loadRepo(res, did)
  const diff = await repo.getDiffCar(from)
  res.status(200).send(Buffer.from(diff))
})

export const postRepoReq = z.object({
  did: z.string(),
})
export type PostRepoReq = z.infer<typeof postRepoReq>

router.get('/:did', async (req, res) => {
  // we don't need auth here because the auth is on the data structure 😎
  const { did } = util.checkReqBody(req.params, postRepoReq)
  const bytes = await util.readReqBytes(req)

  const repo = await util.maybeLoadRepo(res, did)

  if (repo) {
    await repo.loadAndVerifyDiff(bytes, async (evt) => {
      console.log('EVT: ', evt)
    })
  } else {
    const blockstore = util.getBlockstore(res)
    await Repo.fromCarFile(bytes, blockstore, async (evt) => {
      console.log('EVT: ', evt)
    })
  }

  // const { did } = util.checkReqBody(req.query, getRepoReq)
  // const db = util.getDB(res)
  // const root = await db.getRepoRoot(did)
  res.status(200).send()
})

export default router
