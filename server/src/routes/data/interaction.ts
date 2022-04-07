import express from 'express'
import { z } from 'zod'
import * as auth from '../../auth.js'
import * as util from '../../util.js'
import { ServerError } from '../../error.js'
import { schema, check, TID, ucanCheck } from '@bluesky-demo/common'
import { SERVER_DID } from '../../server-identity.js'

const router = express.Router()

// GET INTERACTION
// --------------

// find a like by it's TID
const byTid = z.object({
  did: z.string(),
  namespace: z.string(),
  tid: z.string(),
})

// find a like by the post it's on
const byPost = z.object({
  did: z.string(),
  postAuthor: z.string(),
  postNamespace: z.string(),
  postTid: z.string(),
})

export const getInteractionReq = z.union([byTid, byPost])
export type GetInteractionReq = z.infer<typeof getInteractionReq>

router.get('/', async (req, res) => {
  if (!check.is(req.query, getInteractionReq)) {
    throw new ServerError(400, 'Poorly formatted request')
  }
  if (check.is(req.query, byTid)) {
    const { did, namespace, tid } = req.query
    const repo = await util.loadRepo(res, did)
    const interCid = await repo.runOnNamespace(namespace, async (store) => {
      return store.interactions.getEntry(TID.fromStr(tid))
    })
    if (interCid === null) {
      throw new ServerError(404, 'Could not find interaction')
    }
    const like = await repo.get(interCid, schema.microblog.like)
    res.status(200).send(like)
  } else {
    const { did, postAuthor, postNamespace, postTid } = req.query
    const db = util.getDB(res)
    const like = await db.getLikeByPost(did, postTid, postAuthor, postNamespace)
    if (like === null) {
      throw new ServerError(404, 'Could not find interaction')
    }
    res.status(200).send(like)
  }
})

// LIST INTERACTIONS
// --------------

export const listInteractionsReq = z.object({
  did: z.string(),
  namespace: z.string(),
  count: z.string(),
  from: z.string().optional(),
})
export type ListInteractionsReq = z.infer<typeof listInteractionsReq>

router.get('/list', async (req, res) => {
  if (!check.is(req.query, listInteractionsReq)) {
    throw new ServerError(400, 'Poorly formatted request')
  }
  const { did, namespace, count, from } = req.query
  const countParsed = parseInt(count)
  if (isNaN(countParsed)) {
    throw new ServerError(
      400,
      'Poorly formatted request: `count` is not a number',
    )
  }
  const fromTid = from ? TID.fromStr(from) : undefined
  const repo = await util.loadRepo(res, did)
  const entries = await repo.runOnNamespace(namespace, async (store) => {
    return store.interactions.getEntries(countParsed, fromTid)
  })
  const posts = await Promise.all(
    entries.map((entry) => repo.get(entry.cid, schema.microblog.like)),
  )
  res.status(200).send(posts)
})

// CREATE INTERACTION
// --------------

export const createInteractionReq = schema.microblog.like
export type CreateInteractionReq = z.infer<typeof createInteractionReq>

router.post('/', async (req, res) => {
  if (!check.is(req.body, createInteractionReq)) {
    throw new ServerError(400, 'Poorly formatted request')
  }
  const like = req.body
  const ucanStore = await auth.checkReq(
    req,
    ucanCheck.hasAudience(SERVER_DID),
    ucanCheck.hasPostingPermission(
      like.author,
      like.namespace,
      'interactions',
      TID.fromStr(like.tid),
    ),
  )
  const repo = await util.loadRepo(res, like.author, ucanStore)
  const likeCid = await repo.put(like)
  await repo.runOnNamespace(like.namespace, async (store) => {
    return store.interactions.addEntry(TID.fromStr(like.tid), likeCid)
  })
  const db = util.getDB(res)
  await db.updateRepoRoot(like.author, repo.cid)
  await db.createLike(like, likeCid)
  res.status(200).send()
})

// DELETE INTERACTION
// --------------

export const deleteInteractionReq = z.object({
  did: z.string(),
  namespace: z.string(),
  tid: z.string(),
})
export type DeleteInteractionReq = z.infer<typeof deleteInteractionReq>

router.delete('/', async (req, res) => {
  if (!check.is(req.body, deleteInteractionReq)) {
    throw new ServerError(400, 'Poorly formatted request')
  }
  const { did, namespace, tid } = req.body
  const tidObj = TID.fromStr(tid)
  const ucanStore = await auth.checkReq(
    req,
    ucanCheck.hasAudience(SERVER_DID),
    ucanCheck.hasPostingPermission(did, namespace, 'interactions', tidObj),
  )
  const repo = await util.loadRepo(res, did, ucanStore)
  await repo.runOnNamespace(namespace, async (store) => {
    return store.interactions.deleteEntry(tidObj)
  })
  const db = util.getDB(res)
  await db.deleteLike(tidObj.toString(), did, namespace)
  await db.updateRepoRoot(did, repo.cid)
  res.status(200).send()
})

export default router
