import { Repo, ucanCheck } from '@bluesky-demo/common'

import * as auth from '../auth.js'
import express from 'express'
import { SERVER_DID, SERVER_KEYPAIR } from '../server-identity.js'
import * as util from '../util.js'

const router = express.Router()

router.post('/register', async (req, res) => {
  // use UCAN validation for this
  const { username, did } = req.body
  const { db, blockstore } = util.getLocals(res)
  const ucanStore = await auth.checkReq(
    req,
    ucanCheck.hasAudience(SERVER_DID),
    ucanCheck.hasMaintenancePermission(did),
  )
  // create empty repo
  const repo = await Repo.create(blockstore, did, SERVER_KEYPAIR, ucanStore)
  await Promise.all([
    db.registerDid(username, did),
    db.createRepoRoot(did, repo.cid),
  ])
  return res.sendStatus(200)
})

export default router
