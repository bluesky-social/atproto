import express from 'express'
import { Repo } from '@bluesky-demo/common'
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
  let repo: Repo
  if (!currRoot) {
    try {
      repo = await Repo.fromCarFile(bytes, blockstore)
    } catch (err) {
      return res.status(400).send('Could not parse Repo from CAR File')
    }
    await db.createRepoRoot(did, repo.cid)
  } else {
    repo = await Repo.load(blockstore, currRoot)
    await repo.loadCar(bytes)
    await db.updateRepoRoot(did, repo.cid)
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
  const repo = await Repo.load(blockstore, userRoot, SERVER_KEYPAIR)

  const bytes = await repo.getCarNoHistory()
  return res.status(200).send(Buffer.from(bytes))
})

export default router
