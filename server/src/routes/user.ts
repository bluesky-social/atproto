import express from 'express'
import { UserStore } from '@bluesky-demo/common'
import * as UserRoots from '../db/index.js'
import * as util from '../util.js'
import { SERVER_KEYPAIR } from '../server-identity.js'

const router = express.Router()

// @@TODO Remove or udpate
router.post('/:did', async (req, res) => {
  const { did } = req.params
  const bytes = await util.readReqBytes(req)
  const db = util.getDB(res)
  const blockstore = util.getBlockstore(res)
  const currRoot = await db.getRepoRoot(did)
  let userStore: UserStore
  if (!currRoot) {
    try {
      userStore = await UserStore.fromCarFile(bytes, blockstore)
    } catch (err) {
      return res.status(400).send('Could not parse UserStore from CAR File')
    }
    await db.createRepoRoot(did, userStore.cid)
  } else {
    userStore = await UserStore.load(blockstore, currRoot)
    await userStore.loadCar(bytes)
    await db.updateRepoRoot(did, userStore.cid)
  }

  return res.sendStatus(200)
})

router.get('/:did', async (req, res) => {
  const { did } = req.params

  const db = util.getDB(res)
  const userRoot = await db.getRepoRoot(did)
  if (!userRoot) {
    return res.status(404).send('User not found')
  }

  const blockstore = util.getBlockstore(res)
  const userStore = await UserStore.load(blockstore, userRoot, SERVER_KEYPAIR)

  const bytes = await userStore.getCarNoHistory()
  return res.status(200).send(Buffer.from(bytes))
})

export default router
