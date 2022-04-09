import express from 'express'
import { z } from 'zod'
import * as auth from '../../auth.js'
import * as util from '../../util.js'
import { ServerError } from '../../error.js'
import { flattenPost, schema, TID, ucanCheck } from '@bluesky-demo/common'
import { SERVER_DID } from '../../server-identity.js'
import * as subscriptions from '../../subscriptions.js'

const router = express.Router()

// GET POST
// --------------

export const getPostReq = z.object({
  did: z.string(),
  namespace: z.string(),
  tid: schema.repo.strToTid,
})
export type GetPostReq = z.infer<typeof getPostReq>

router.get('/', async (req, res) => {
  const { did, namespace, tid } = util.checkReqBody(req.query, getPostReq)
  const repo = await util.loadRepo(res, did)
  const postCid = await repo.runOnNamespace(namespace, async (store) => {
    return store.posts.getEntry(tid)
  })
  if (postCid === null) {
    throw new ServerError(404, 'Could not find post')
  }
  const post = await repo.get(postCid, schema.microblog.post)
  res.status(200).send(flattenPost(post))
})

// LIST POSTS
// --------------

export const listPostsReq = z.object({
  did: z.string(),
  namespace: z.string(),
  count: schema.common.strToInt,
  from: z.string().optional(),
})
export type ListPostsReq = z.infer<typeof listPostsReq>

router.get('/list', async (req, res) => {
  const { did, namespace, count, from } = util.checkReqBody(
    req.query,
    listPostsReq,
  )
  const fromTid = from ? TID.fromStr(from) : undefined
  const repo = await util.loadRepo(res, did)
  const entries = await repo.runOnNamespace(namespace, async (store) => {
    return store.posts.getEntries(count, fromTid)
  })
  const posts = await Promise.all(
    entries.map((entry) => repo.get(entry.cid, schema.microblog.post)),
  )
  const flattened = posts.map(flattenPost)
  res.status(200).send(flattened)
})

// CREATE POST
// --------------

export const createPostReq = schema.microblog.post
export type CreatePostReq = z.infer<typeof createPostReq>

router.post('/', async (req, res) => {
  const post = util.checkReqBody(req.body, createPostReq)
  const ucanStore = await auth.checkReq(
    req,
    ucanCheck.hasAudience(SERVER_DID),
    ucanCheck.hasPostingPermission(
      post.author,
      post.namespace,
      'posts',
      post.tid,
    ),
  )
  const repo = await util.loadRepo(res, post.author, ucanStore)
  const postCid = await repo.put(flattenPost(post))
  await repo.runOnNamespace(post.namespace, async (store) => {
    return store.posts.addEntry(post.tid, postCid)
  })
  const db = util.getDB(res)
  await db.createPost(post, postCid)
  await db.updateRepoRoot(post.author, repo.cid)
  await subscriptions.notifySubscribers(db, repo)
  res.status(200).send()
})

// UPDATE POST
// --------------

export const editPostReq = schema.microblog.post
export type EditPostReq = z.infer<typeof editPostReq>

router.put('/', async (req, res) => {
  const post = util.checkReqBody(req.body, editPostReq)
  const ucanStore = await auth.checkReq(
    req,
    ucanCheck.hasAudience(SERVER_DID),
    ucanCheck.hasPostingPermission(
      post.author,
      post.namespace,
      'posts',
      post.tid,
    ),
  )
  const repo = await util.loadRepo(res, post.author, ucanStore)
  const postCid = await repo.put(flattenPost(post))
  await repo.runOnNamespace(post.namespace, async (store) => {
    return store.posts.editEntry(post.tid, postCid)
  })
  const db = util.getDB(res)
  await db.updatePost(post, postCid)
  await db.updateRepoRoot(post.author, repo.cid)
  await subscriptions.notifySubscribers(db, repo)
  res.status(200).send()
})

// DELETE POST
// --------------

export const deletePostReq = z.object({
  did: z.string(),
  namespace: z.string(),
  tid: schema.repo.strToTid,
})
export type DeletePostReq = z.infer<typeof deletePostReq>

router.delete('/', async (req, res) => {
  const { did, namespace, tid } = util.checkReqBody(req.body, deletePostReq)
  const ucanStore = await auth.checkReq(
    req,
    ucanCheck.hasAudience(SERVER_DID),
    ucanCheck.hasPostingPermission(did, namespace, 'posts', tid),
  )
  const repo = await util.loadRepo(res, did, ucanStore)
  await repo.runOnNamespace(namespace, async (store) => {
    return store.posts.deleteEntry(tid)
  })
  const db = util.getDB(res)
  await db.deletePost(tid.toString(), did, namespace)
  await db.updateRepoRoot(did, repo.cid)
  await subscriptions.notifySubscribers(db, repo)
  res.status(200).send()
})

export default router
