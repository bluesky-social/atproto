import { z } from 'zod'
import express from 'express'
import * as UserRoots from '../../db/user-roots.js'
import * as util from '../../util.js'
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
  if (!check.is(req.body, createPostReq)) {
    return res.status(400).send('Poorly formatted request')
  }
  const { did, program, post } = req.body
  const userStore = await util.loadUserStore(res, did)
  const postCid = await userStore.put(post)
  userStore.runOnProgram(program, async (store) => {
    return store.posts.addEntry(TID.fromStr(post.tid), postCid)
  })
  const db = util.getDB(res)
  await UserRoots.update(db, did, userStore.cid)
  res.status(200).send()
})

// CREATE POST
// --------------

export const createPostReq = z.object({
  did: z.string(),
  program: z.string(),
  post: schema.microblog.post,
})
export type CreatePostReq = z.infer<typeof createPostReq>

router.post('/', async (req, res) => {
  if (!check.is(req.body, createPostReq)) {
    return res.status(400).send('Poorly formatted request')
  }
  const { did, program, post } = req.body
  const userStore = await util.loadUserStore(res, did)
  const postCid = await userStore.put(post)
  userStore.runOnProgram(program, async (store) => {
    return store.posts.addEntry(TID.fromStr(post.tid), postCid)
  })
  const db = util.getDB(res)
  await UserRoots.update(db, did, userStore.cid)
  res.status(200).send()
})

// UPDATE POST
// --------------

export const editPostReq = z.object({
  did: z.string(),
  program: z.string(),
  post: schema.microblog.post,
})
export type EditPostReq = z.infer<typeof editPostReq>

router.put('/', async (req, res) => {
  if (!check.is(req.body, editPostReq)) {
    return res.status(400).send('Poorly formatted request')
  }
  const { did, program, post } = req.body
  const userStore = await util.loadUserStore(res, did)
  const postCid = await userStore.put(post)
  userStore.runOnProgram(program, async (store) => {
    return store.posts.editEntry(TID.fromStr(post.tid), postCid)
  })
  const db = util.getDB(res)
  await UserRoots.update(db, did, userStore.cid)
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
  if (!check.is(req.body, deletePostReq)) {
    return res.status(400).send('Poorly formatted request')
  }
  const { did, program, tid } = req.body
  const userStore = await util.loadUserStore(res, did)
  userStore.runOnProgram(program, async (store) => {
    return store.posts.deleteEntry(TID.fromStr(tid))
  })
  const db = util.getDB(res)
  await UserRoots.update(db, did, userStore.cid)
  res.status(200).send()
})

export default router
