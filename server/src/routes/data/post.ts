import express from 'express'
import { z } from 'zod'
import * as util from '../../util.js'
import { ServerError } from '../../error.js'
import { schema, check, TID } from '@bluesky-demo/common'

const router = express.Router()

// GET POST
// --------------

export const getPostReq = z.object({
  did: z.string(),
  program: z.string(),
  tid: z.string(),
})
export type GetPostReq = z.infer<typeof getPostReq>

router.get('/', async (req, res) => {
  if (!check.is(req.query, getPostReq)) {
    throw new ServerError(400, 'Poorly formatted request')
  }
  const { did, program, tid } = req.query
  const userStore = await util.loadUserStore(res, did)
  const postCid = await userStore.runOnProgram(program, async (store) => {
    return store.posts.getEntry(TID.fromStr(tid))
  })
  if (postCid === null) {
    throw new ServerError(404, 'Could not find post')
  }
  const post = await userStore.get(postCid, schema.microblog.post)
  res.status(200).send(post)
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
  const userStore = await util.loadUserStore(res, post.author)
  const postCid = await userStore.put(post)
  await userStore.runOnProgram(post.program, async (store) => {
    return store.posts.addEntry(TID.fromStr(post.tid), postCid)
  })
  const db = util.getDB(res)
  await db.updateRepoRoot(post.author, userStore.cid)
  await db.createPost(post, postCid)
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
  const userStore = await util.loadUserStore(res, post.author)
  const postCid = await userStore.put(post)
  await userStore.runOnProgram(post.program, async (store) => {
    return store.posts.editEntry(TID.fromStr(post.tid), postCid)
  })
  const db = util.getDB(res)
  await db.updateRepoRoot(post.author, userStore.cid)
  await db.updatePost(post, postCid)
  res.status(200).send()
})

// DELETE POST
// --------------

export const deletePostReq = z.object({
  did: z.string(),
  program: z.string(),
  tid: z.string(),
})
export type DeletePostReq = z.infer<typeof deletePostReq>

router.delete('/', async (req, res) => {
  if (!check.is(req.params, deletePostReq)) {
    throw new ServerError(400, 'Poorly formatted request')
  }
  const { did, program, tid } = req.params
  const userStore = await util.loadUserStore(res, did)
  await userStore.runOnProgram(program, async (store) => {
    return store.posts.deleteEntry(TID.fromStr(tid))
  })
  const db = util.getDB(res)
  await db.updateRepoRoot(did, userStore.cid)
  await db.deletePost(did, program, tid)
  res.status(200).send()
})

export default router
