import express from 'express'
import { z } from 'zod'

import { service } from '@adxp/common'
import * as authLib from '@adxp/auth'
import * as auth from '../../auth.js'
import * as util from '../../util.js'
import * as subscriptions from '../../subscriptions.js'
import { SERVER_DID } from '../../server-identity.js'
import { ServerError } from '../../error.js'

const router = express.Router()

// CREATE

export const createRelReq = z.object({
  creator: z.string(),
  target: z.string(),
})
export type CreateRelReq = z.infer<typeof createRelReq>

router.post('/', async (req, res) => {
  const { creator, target } = util.checkReqBody(req.body, createRelReq)
  const authStore = await auth.checkReq(
    req,
    authLib.hasAudience(SERVER_DID),
    authLib.hasRelationshipsPermission(creator),
  )
  const db = util.getDB(res)
  const username = await service.getUsernameFromDidNetwork(target)
  if (!username) {
    throw new ServerError(404, `Could not find user on DID network: ${target}`)
  }
  const [name, host] = username.split('@')
  if (!host) {
    throw new ServerError(400, 'Expected a username with a host')
  }
  const ownHost = util.getOwnHost(req)
  if (host !== ownHost) {
    await db.registerDid(name, target, host)
    await service.subscribe(`http://${host}`, target, `http://${ownHost}`)
  }

  const repo = await util.loadRepo(res, creator, authStore)
  await repo.relationships.follow(target, username)
  await db.createFollow(creator, target)
  await db.updateRepoRoot(creator, repo.cid)
  await subscriptions.notifyOneOff(db, util.getOwnHost(req), target, repo)
  await subscriptions.notifySubscribers(db, repo)
  res.status(200).send()
})

// DELETE

export const deleteRelReq = z.object({
  creator: z.string(),
  target: z.string(),
})
export type DeleteRelReq = z.infer<typeof deleteRelReq>

router.delete('/', async (req, res) => {
  const { creator, target } = util.checkReqBody(req.body, deleteRelReq)
  const authStore = await auth.checkReq(
    req,
    authLib.hasAudience(SERVER_DID),
    authLib.hasRelationshipsPermission(creator),
  )
  const db = util.getDB(res)
  const repo = await util.loadRepo(res, creator, authStore)
  await repo.relationships.unfollow(target)
  await db.deleteFollow(creator, target)
  await db.updateRepoRoot(creator, repo.cid)
  await subscriptions.notifyOneOff(db, util.getOwnHost(req), target, repo)
  await subscriptions.notifySubscribers(db, repo)
  res.status(200).send()
})

// LIST

export const listRelReq = z.object({
  user: z.string(),
})
export type ListRelReq = z.infer<typeof listRelReq>

router.get('/list', async (req, res) => {
  const { user } = util.checkReqBody(req.query, listRelReq)
  const db = util.getDB(res)
  const follows = await db.listFollows(user)
  res.status(200).send(follows)
})

export default router
