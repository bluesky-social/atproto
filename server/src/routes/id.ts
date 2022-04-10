import express from 'express'
import { z } from 'zod'

import { Repo, ucanCheck } from '@bluesky/common'

import * as auth from '../auth.js'
import { SERVER_DID, SERVER_KEYPAIR } from '../server-identity.js'
import * as util from '../util.js'
import { ServerError } from '../error.js'

const router = express.Router()

export const registerReq = z.object({
  did: z.string(),
  username: z.string(),
  createRepo: z.boolean(),
})
export type registerReq = z.infer<typeof registerReq>

router.post('/register', async (req, res) => {
  const { username, did, createRepo } = util.checkReqBody(req.body, registerReq)
  if (username.startsWith('did:')) {
    throw new ServerError(
      400,
      'Cannot register a username that starts with `did:`',
    )
  }
  const { db, blockstore } = util.getLocals(res)
  const ucanStore = await auth.checkReq(
    req,
    ucanCheck.hasAudience(SERVER_DID),
    ucanCheck.hasMaintenancePermission(did),
  )
  const host = req.get('host')
  if (!host) {
    throw new ServerError(500, 'Could not get own host')
  }

  // create empty repo
  if (createRepo) {
    const repo = await Repo.create(blockstore, did, SERVER_KEYPAIR, ucanStore)
    await Promise.all([
      db.registerDid(username, did, host),
      db.createRepoRoot(did, repo.cid),
    ])
  }

  return res.sendStatus(200)
})

export default router
