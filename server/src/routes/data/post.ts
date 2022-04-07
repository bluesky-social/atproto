import express from 'express'
import { z } from 'zod'
import * as auth from '../../auth.js'
import * as util from '../../util.js'
import { ServerError } from '../../error.js'
import { schema, check, TID, ucanCheck } from '@bluesky-demo/common'
import { SERVER_DID } from '../../server-identity.js'

const router = express.Router()

// GET POST
// --------------

export const getPostReq = z.object({
  did: z.string(),
  namespace: z.string(),
  tid: z.string(),
})
export type GetPostReq = z.infer<typeof getPostReq>

router.get('/', async (req, res) => {
  if (!check.is(req.query, getPostReq)) {
    throw new ServerError(400, 'Poorly formatted request')
  }
  const { did, namespace, tid } = req.query
  const repo = await util.loadRepo(res, did)
  const postCid = await repo.runOnNamespace(namespace, async (store) => {
    return store.posts.getEntry(TID.fromStr(tid))
  })
  if (postCid === null) {
    throw new ServerError(404, 'Could not find post')
  }
  const post = await repo.get(postCid, schema.microblog.post)
  res.status(200).send(post)
})

// LIST POSTS
// --------------

export const listPostsReq = z.object({
  did: z.string(),
  namespace: z.string(),
  count: z.string(),
  from: z.string().optional(),
})
export type ListPostsReq = z.infer<typeof listPostsReq>

router.get('/list', async (req, res) => {
  if (!check.is(req.query, listPostsReq)) {
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
    return store.posts.getEntries(countParsed, fromTid)
  })
  const posts = await Promise.all(
    entries.map((entry) => repo.get(entry.cid, schema.microblog.post)),
  )
  res.status(200).send(posts)
})

// CREATE POST
// --------------

export const createPostReq = schema.microblog.post
export type CreatePostReq = z.infer<typeof createPostReq>

router.post('/', async (req, res) => {
  if (!check.is(req.body, createPostReq)) {
    throw new ServerError(400, 'Poorly formatted request')
  }
  const post = req.body
  const ucanStore = await auth.checkReq(
    req,
    ucanCheck.hasAudience(SERVER_DID),
    ucanCheck.hasPostingPermission(
      post.author,
      post.namespace,
      'posts',
      TID.fromStr(post.tid),
    ),
  )
  const repo = await util.loadRepo(res, post.author, ucanStore)
  const postCid = await repo.put(post)
  await repo.runOnNamespace(post.namespace, async (store) => {
    return store.posts.addEntry(TID.fromStr(post.tid), postCid)
  })
  const db = util.getDB(res)
  await db.createPost(post, postCid)
  await db.updateRepoRoot(post.author, repo.cid)
  res.status(200).send()
})

// UPDATE POST
// --------------

export const editPostReq = schema.microblog.post
export type EditPostReq = z.infer<typeof editPostReq>

router.put('/', async (req, res) => {
  if (!check.is(req.body, editPostReq)) {
    throw new ServerError(400, 'Poorly formatted request')
  }
  const post = req.body
  const tid = TID.fromStr(post.tid)
  const ucanStore = await auth.checkReq(
    req,
    ucanCheck.hasAudience(SERVER_DID),
    ucanCheck.hasPostingPermission(post.author, post.namespace, 'posts', tid),
  )
  const repo = await util.loadRepo(res, post.author, ucanStore)
  const postCid = await repo.put(post)
  await repo.runOnNamespace(post.namespace, async (store) => {
    return store.posts.editEntry(tid, postCid)
  })
  const db = util.getDB(res)
  await db.updatePost(post, postCid)
  await db.updateRepoRoot(post.author, repo.cid)
  res.status(200).send()
})

// DELETE POST
// --------------

export const deletePostReq = z.object({
  did: z.string(),
  namespace: z.string(),
  tid: z.string(),
})
export type DeletePostReq = z.infer<typeof deletePostReq>

router.delete('/', async (req, res) => {
  if (!check.is(req.body, deletePostReq)) {
    throw new ServerError(400, 'Poorly formatted request')
  }
  const { did, namespace, tid } = req.body
  const tidObj = TID.fromStr(tid)
  const ucanStore = await auth.checkReq(
    req,
    ucanCheck.hasAudience(SERVER_DID),
    ucanCheck.hasPostingPermission(did, namespace, 'posts', tidObj),
  )
  const repo = await util.loadRepo(res, did, ucanStore)
  await repo.runOnNamespace(namespace, async (store) => {
    return store.posts.deleteEntry(tidObj)
  })
  const db = util.getDB(res)
  await db.deletePost(tidObj.toString(), did, namespace)
  await db.updateRepoRoot(did, repo.cid)
  res.status(200).send()
})

export default router
