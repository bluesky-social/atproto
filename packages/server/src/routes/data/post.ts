import express from 'express'
import { z } from 'zod'
import {
  PdsError,
  describeRepoParams,
  DescribeRepoResponse,
  listRecordsParams,
} from '@adxp/api'
import * as auth from '../../auth.js'
import * as util from '../../util.js'
import { ServerError } from '../../error.js'
import { flattenPost, schema, TID, resolveName } from '@adxp/common'
import * as authLib from '@adxp/auth'
import * as didSdk from '@adxp/did-sdk'
import { SERVER_DID } from '../../server-identity.js'
import * as subscriptions from '../../subscriptions.js'

const router = express.Router()

// DESCRIBE REPO
// -------------

export const getPathParams = z.object({
  nameOrDid: z.string(),
})

async function resolveDidWrapped(did: string) {
  try {
    return (await didSdk.resolve(did)).didDoc
  } catch (e) {
    throw new PdsError('DidResolutionFailed', `Failed to resolve DID "${did}"`)
  }
}

async function resolveNameWrapped(name: string) {
  try {
    return await resolveName(name)
  } catch (e) {
    throw new PdsError(
      'NameResolutionFailed',
      `Failed to resolve name "${name}"`,
    )
  }
}

router.get('/:nameOrDid', async (req, res) => {
  const { nameOrDid } = req.params
  const { confirmName } = util.checkReqBody(req.query, describeRepoParams)

  let name: string | undefined
  let did: string
  let didDoc: didSdk.DIDDocument
  let nameIsCorrect: boolean | undefined

  if (nameOrDid.startsWith('did:')) {
    did = nameOrDid
    didDoc = await resolveDidWrapped(did)
    name = 'undefined' // TODO: need to decide how username gets published in the did doc
    if (confirmName) {
      const namesDeclaredDid = await resolveNameWrapped(name)
      nameIsCorrect = did === namesDeclaredDid
    }
  } else {
    name = nameOrDid
    did = await resolveNameWrapped(name)
    didDoc = await resolveDidWrapped(did)
    if (confirmName) {
      const didsDeclaredName = 'undefined' // TODO: need to decide how username gets published in the did doc
      nameIsCorrect = name === didsDeclaredName
    }
  }

  // TODO: list collections

  const resBody: DescribeRepoResponse = { name, did, didDoc, nameIsCorrect }
  res.status(200)
  res.json(resBody)
})

// EXECUTE TRANSACTION
// -------------------

export const createPostReq = schema.microblog.post
export type CreatePostReq = z.infer<typeof createPostReq>

router.post('/:did', async (req, res) => {
  const post = util.checkReqBody(req.body, createPostReq)
  const authStore = await checkReq(
    req,
    res,
    auth.writeCap(post.author, post.namespace, 'posts', post.tid.toString()),
  )
  const repo = await util.loadRepo(res, post.author, authStore)
  const postCid = await repo.put(flattenPost(post))
  await repo.runOnNamespace(post.namespace, async (store) => {
    return store.posts.addEntry(post.tid, postCid)
  })
  const db = util.getDB(res)
  await db.createPost(post, postCid)
  await db.updateRepoRoot(post.author, repo.cid)
  await subscriptions.notifySubscribers(db, repo)
  res.status(200).send()

  /*

// UPDATE RECORD
// -------------

export const editPostReq = schema.microblog.post
export type EditPostReq = z.infer<typeof editPostReq>

router.put('/:did/c/:coll/r/:key', async (req, res) => {
  const post = util.checkReqBody(req.body, editPostReq)
  const authStore = await checkReq(
    req,
    res,
    auth.writeCap(post.author, post.namespace, 'posts', post.tid.toString()),
  )
  const repo = await util.loadRepo(res, post.author, authStore)
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

// DELETE RECORD
// -------------

export const deletePostReq = z.object({
  did: z.string(),
  namespace: z.string(),
  tid: schema.repo.strToTid,
})
export type DeletePostReq = z.infer<typeof deletePostReq>

router.delete('/:did/c/:coll/r/:key', async (req, res) => {
  const { did, namespace, tid } = util.checkReqBody(req.body, deletePostReq)
  const authStore = await checkReq(
    req,
    res,
    auth.writeCap(did, namespace, 'posts', tid.toString()),
  )
  const repo = await util.loadRepo(res, did, authStore)
  await repo.runOnNamespace(namespace, async (store) => {
    return store.posts.deleteEntry(tid)
  })
  const db = util.getDB(res)
  await db.deletePost(tid.toString(), did, namespace)
  await db.updateRepoRoot(did, repo.cid)
  await subscriptions.notifySubscribers(db, repo)
  res.status(200).send()
})

*/
})

// LIST RECORDS
// ------------

router.get('/:nameOrDid/c/:coll', async (req, res) => {
  const { nameOrDid, coll } = req.params
  const { count, from } = util.checkReqBody(req.query, listRecordsParams)
  const fromTid = from ? TID.fromStr(from) : undefined
  const repo = await util.loadRepo(res, nameOrDid)
  const entries = await repo.runOnNamespace(coll, async (store) => {
    return store.posts.getEntries(count, fromTid)
  })
  const posts = await Promise.all(
    entries.map((entry) => repo.get(entry.cid, schema.microblog.post)),
  )
  const flattened = posts.map(flattenPost)
  res.status(200).send(flattened)
})

// GET RECORD
// ----------

export const getPostReq = z.object({
  nameOrDid: z.string(),
  coll: z.string(),
  recordKey: schema.repo.strToTid,
})
export type GetPostReq = z.infer<typeof getPostReq>

router.get('/:nameOrDid/c/:coll/r/:recordKey', async (req, res) => {
  const { nameOrDid, coll, recordKey } = util.checkReqBody(
    req.params,
    getPostReq,
  )
  const repo = await util.loadRepo(res, nameOrDid)
  const postCid = await repo.runOnNamespace(coll, async (store) => {
    return store.posts.getEntry(recordKey)
  })
  if (postCid === null) {
    throw new ServerError(404, 'Could not find post')
  }
  const post = await repo.get(postCid, schema.microblog.post)
  res.status(200).send(flattenPost(post))
})

export default router
