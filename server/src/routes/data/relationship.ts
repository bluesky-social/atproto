import express from 'express'
import { z } from 'zod'

import { service, ucanCheck } from '@bluesky/common'
import * as auth from '../../auth.js'
import * as util from '../../util.js'
import * as subscriptions from '../../subscriptions.js'
import { SERVER_DID } from '../../server-identity.js'
import { ServerError } from '../../error.js'

const router = express.Router()

// CREATE

export const createRelReq = z.object({
  creator: z.string(),
  username: z.string(),
})
export type CreateRelReq = z.infer<typeof createRelReq>

router.post('/', async (req, res) => {
  const { creator, username } = util.checkReqBody(req.body, createRelReq)
  const ucanStore = await auth.checkReq(
    req,
    ucanCheck.hasAudience(SERVER_DID),
    ucanCheck.hasRelationshipsPermission(creator),
  )
  const db = util.getDB(res)
  const [name, host] = username.split('@')
  if (!host) {
    throw new ServerError(400, 'Expected a username with a host')
  }
  const ownHost = req.get('host')
  let target: string
  if (host !== ownHost) {
    const did = await service.lookupDid(`http://${host}`, name)
    if (did === null) {
      throw new ServerError(404, `Could not find user: ${username}`)
    }
    target = did
    await db.registerDid(name, did, host)
    await service.subscribe(`http://${host}`, target, `http://${ownHost}`)
  } else {
    const did = await db.getDidForUser(name, ownHost)
    if (did === null) {
      throw new ServerError(404, `Could not find user: ${username}`)
    }
    target = did
  }
  const repo = await util.loadRepo(res, creator, ucanStore)
  await repo.relationships.follow(target, username)
  await db.createFollow(creator, target)
  await db.updateRepoRoot(creator, repo.cid)
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
  const ucanStore = await auth.checkReq(
    req,
    ucanCheck.hasAudience(SERVER_DID),
    ucanCheck.hasRelationshipsPermission(creator),
  )
  const db = util.getDB(res)
  const repo = await util.loadRepo(res, creator, ucanStore)
  await repo.relationships.unfollow(target)
  await db.deleteFollow(creator, target)
  await db.updateRepoRoot(creator, repo.cid)
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
