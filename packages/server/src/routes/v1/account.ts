import express from 'express'
import { z } from 'zod'

import { Repo } from '@adxp/common'
import * as auth from '@adxp/auth'

import * as serverAuth from '../../auth'
import * as util from '../../util'
import { ServerError } from '../../error'

const router = express.Router()

export const registerReq = z.object({
  username: z.string(),
})
export type RegisterReq = z.infer<typeof registerReq>

router.get('/', async (req, res) => {
  // TODO get information about the session account
  res.sendStatus(501)
})

// @TODO fix this whole route lol
router.post('/', async (req, res) => {
  const { username } = util.checkReqBody(req.body, registerReq)
  if (username.startsWith('did:')) {
    throw new ServerError(
      400,
      'Cannot register a username that starts with `did:`',
    )
  }

  const { db, blockstore, keypair } = util.getLocals(res)
  const did = `did:example:${username}`
  await db.setUserDid(username, did)

  const authStore = await auth.AuthStore.fromTokens(keypair, [])
  const repo = await Repo.create(blockstore, did, authStore)
  await db.setRepoRoot(did, repo.cid)

  // const authStore = await serverAuth.checkReq(
  //   req,
  //   res,
  //   auth.maintenanceCap(did),
  // )
  // const host = util.getOwnHost(req)

  // if (await db.isNameRegistered(username, host)) {
  //   throw new ServerError(409, 'Username already taken')
  // } else if (await db.isDidRegistered(did)) {
  //   throw new ServerError(409, 'Did already registered')
  // }

  // await db.registerDid(username, did, host)
  // // create empty repo
  // if (createRepo) {
  //   const repo = await Repo.create(blockstore, did, authStore)
  //   await db.createRepoRoot(did, repo.cid)
  // }

  return res.sendStatus(200)
})

router.delete('/', async (req, res) => {
  // TODO delete the session account
  res.sendStatus(501)
})

export default router
