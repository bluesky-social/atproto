import { Repo } from '@bluesky-demo/common'
import express from 'express'
import { SERVER_KEYPAIR } from '../server-identity.js'
import * as util from '../util.js'

const router = express.Router()

router.post('/register', async (req, res) => {
  // use UCAN validation for this
  const { username, did } = req.body
  const { db, blockstore } = util.getLocals(res)
  // create empty repo
  const repo = await Repo.create(blockstore, did, SERVER_KEYPAIR)
  await Promise.all([
    db.registerDid(username, did),
    db.createRepoRoot(did, repo.cid),
  ])
  return res.sendStatus(200)
})

export default router
