import express from 'express'
import { z } from 'zod'
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
  console.log('QUERY: ', req.query)
  if (!check.is(req.query, getPostReq)) {
    return res.status(400).send('Poorly formatted request')
  }
  const { did, program, tid } = req.query
  const userStore = await util.loadUserStore(res, did)
  console.log('GOT ROOT: ', userStore.cid)
  const postCid = await userStore.runOnProgram(program, async (store) => {
    return store.posts.getEntry(TID.fromStr(tid))
  })
  if (postCid === null) {
    return res.status(404).send('Could not find post')
  }
  const post = await userStore.get(postCid, schema.microblog.post)
  res.status(200).send(post)
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
  await userStore.runOnProgram(program, async (store) => {
    return store.posts.addEntry(TID.fromStr(post.tid), postCid)
  })
  const db = util.getDB(res)
  await UserRoots.update(db, did, userStore.cid)
  console.log('UDPATED ROOT: ', userStore.cid)
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
  await userStore.runOnProgram(program, async (store) => {
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
  await userStore.runOnProgram(program, async (store) => {
    return store.posts.deleteEntry(TID.fromStr(tid))
  })
  const db = util.getDB(res)
  await UserRoots.update(db, did, userStore.cid)
  res.status(200).send()
})

export default router
