import express from 'express'
import { z } from 'zod'
import * as auth from '../../auth.js'
import * as util from '../../util.js'
import * as subscriptions from '../../subscriptions.js'
import { ServerError } from '../../error.js'
import { schema, check, ucanCheck, flattenLike } from '@bluesky/common'
import { SERVER_DID } from '../../server-identity.js'

const router = express.Router()

// GET INTERACTION
// --------------

// find a like by it's TID
const byTid = z.object({
  did: z.string(),
  namespace: z.string(),
  tid: schema.repo.strToTid,
})

// find a like by the post it's on
const byPost = z.object({
  did: z.string(),
  postAuthor: z.string(),
  postNamespace: z.string(),
  postTid: schema.repo.strToTid,
})

export const getInteractionReq = z.union([byTid, byPost])
export type GetInteractionReq = z.infer<typeof getInteractionReq>

router.get('/', async (req, res) => {
  const query = util.checkReqBody(req.query, getInteractionReq)
  if (check.is(query, byTid)) {
    const { did, namespace, tid } = query
    const repo = await util.loadRepo(res, did)
    const interCid = await repo.runOnNamespace(namespace, async (store) => {
      return store.interactions.getEntry(tid)
    })
    if (interCid === null) {
      throw new ServerError(404, 'Could not find interaction')
    }
    const like = await repo.get(interCid, schema.microblog.like)
    res.status(200).send(like)
  } else {
    const { did, postAuthor, postNamespace, postTid } = query
    const db = util.getDB(res)
    const like = await db.getLikeByPost(
      did,
      postTid.toString(),
      postAuthor,
      postNamespace,
    )
    if (like === null) {
      throw new ServerError(404, 'Could not find interaction')
    }
    res.status(200).send(flattenLike(like))
  }
})

// LIST INTERACTIONS
// --------------

export const listInteractionsReq = z.object({
  did: z.string(),
  namespace: z.string(),
  count: schema.common.strToInt,
  from: schema.repo.strToTid.optional(),
})
export type ListInteractionsReq = z.infer<typeof listInteractionsReq>

router.get('/list', async (req, res) => {
  const { did, namespace, count, from } = util.checkReqBody(
    req.query,
    listInteractionsReq,
  )
  const repo = await util.loadRepo(res, did)
  const entries = await repo.runOnNamespace(namespace, async (store) => {
    return store.interactions.getEntries(count, from)
  })
  const likes = await Promise.all(
    entries.map((entry) => repo.get(entry.cid, schema.microblog.like)),
  )
  const flattened = likes.map(flattenLike)
  res.status(200).send(flattened)
})

// CREATE INTERACTION
// --------------

export const createInteractionReq = schema.microblog.like
export type CreateInteractionReq = z.infer<typeof createInteractionReq>

router.post('/', async (req, res) => {
  const like = util.checkReqBody(req.body, createInteractionReq)
  const ucanStore = await auth.checkReq(
    req,
    ucanCheck.hasAudience(SERVER_DID),
    ucanCheck.hasPostingPermission(
      like.author,
      like.namespace,
      'interactions',
      like.tid,
    ),
  )
  const repo = await util.loadRepo(res, like.author, ucanStore)
  const likeCid = await repo.put(flattenLike(like))
  await repo.runOnNamespace(like.namespace, async (store) => {
    return store.interactions.addEntry(like.tid, likeCid)
  })
  const db = util.getDB(res)
  await db.createLike(like, likeCid)
  await db.updateRepoRoot(like.author, repo.cid)

  await subscriptions.notifyOneOff(
    db,
    util.getOwnHost(req),
    like.post_author,
    repo,
  )
  await subscriptions.notifySubscribers(db, repo)
  res.status(200).send()
})

// DELETE INTERACTION
// --------------

export const deleteInteractionReq = z.object({
  did: z.string(),
  namespace: z.string(),
  tid: schema.repo.strToTid,
})
export type DeleteInteractionReq = z.infer<typeof deleteInteractionReq>

router.delete('/', async (req, res) => {
  const { did, namespace, tid } = util.checkReqBody(
    req.body,
    deleteInteractionReq,
  )
  const ucanStore = await auth.checkReq(
    req,
    ucanCheck.hasAudience(SERVER_DID),
    ucanCheck.hasPostingPermission(did, namespace, 'interactions', tid),
  )
  const repo = await util.loadRepo(res, did, ucanStore)

  // delete the like, but first find the user it was for so we can notify their server
  const postAuthor = await repo.runOnNamespace(namespace, async (store) => {
    const cid = await store.interactions.getEntry(tid)
    if (cid === null) {
      throw new ServerError(404, `Could not find like: ${tid.formatted()}`)
    }
    const like = await repo.get(cid, schema.microblog.like)
    await store.interactions.deleteEntry(tid)
    return like.post_author
  })

  const db = util.getDB(res)
  await db.deleteLike(tid.toString(), did, namespace)
  await db.updateRepoRoot(did, repo.cid)

  await subscriptions.notifyOneOff(db, util.getOwnHost(req), postAuthor, repo)
  await subscriptions.notifySubscribers(db, repo)
  res.status(200).send()
})

export default router
