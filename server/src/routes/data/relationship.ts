import express from 'express'
import { z } from 'zod'
import * as util from '../../util.js'
import { ServerError } from '../../error.js'
import { check } from '@bluesky-demo/common'

const router = express.Router()

// CREATE

export const createRelReq = z.object({
  creator: z.string(),
  target: z.string(),
})
export type CreateRelReq = z.infer<typeof createRelReq>

router.post('/', async (req, res) => {
  if (!check.is(req.body, createRelReq)) {
    throw new ServerError(400, 'Poorly formatted request')
  }
  const { creator, target } = req.body
  const db = util.getDB(res)
  const targetName = await db.getUsername(target)
  if (targetName === null) {
    // @TODO try to find user on network
    throw new ServerError(400, `Could not find user: ${target}`)
  }
  const repo = await util.loadRepo(res, creator)
  await repo.relationships.follow(target, targetName)
  await db.createFollow(creator, target)
  await db.updateRepoRoot(creator, repo.cid)
  res.status(200).send()
})

// DELETE

export const deleteRelReq = z.object({
  creator: z.string(),
  target: z.string(),
})
export type DeleteRelReq = z.infer<typeof deleteRelReq>

router.delete('/', async (req, res) => {
  if (!check.is(req.body, deleteRelReq)) {
    throw new ServerError(400, 'Poorly formatted request')
  }
  const { creator, target } = req.body
  const db = util.getDB(res)
  const repo = await util.loadRepo(res, creator)
  await repo.relationships.unfollow(target)
  await db.deleteFollow(creator, target)
  await db.updateRepoRoot(creator, repo.cid)
  res.status(200).send()
})

// LIST

export const listRelReq = z.object({
  user: z.string(),
})
export type ListRelReq = z.infer<typeof listRelReq>

router.get('/list', async (req, res) => {
  if (!check.is(req.query, listRelReq)) {
    throw new ServerError(400, 'Poorly formatted request')
  }
  const { user } = req.query
  const db = util.getDB(res)
  const follows = await db.listFollows(user)
  res.status(200).send(follows)
})

export default router
