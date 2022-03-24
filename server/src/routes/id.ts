import { UserStore } from '@bluesky-demo/common'
import express from 'express'
import * as UserDids from '../db/user-dids.js'
import * as UserRoots from '../db/user-roots.js'
import { SERVER_KEYPAIR } from '../server-identity.js'
import * as util from '../util.js'

const router = express.Router()

router.post('/register', async (req, res) => {
  // use UCAN validation for this
  const { username, did } = req.body
  const { db, blockstore } = util.getLocals(res)
  // create empty repo
  const userStore = await UserStore.create(blockstore, did, SERVER_KEYPAIR)
  await Promise.all([
    UserDids.register(db, username, did),
    UserRoots.add(db, did, userStore.cid),
  ])
  return res.sendStatus(200)
})

export default router
