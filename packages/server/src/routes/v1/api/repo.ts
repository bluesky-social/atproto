import express from 'express'
import {
  NameResolutionFailed,
  DidResolutionFailed,
  describeRepoParams,
  DescribeRepoResponse,
  listRecordsParams,
  batchWriteParams,
  ListRecordsResponse,
  GetRecordResponse,
} from '@adxp/api'
import { resolveName, AdxUri, BatchWrite, TID } from '@adxp/common'
import * as auth from '@adxp/auth'
import * as didSdk from '@adxp/did-sdk'

import * as repoDiff from '../../../repo-diff'
import * as util from '../../../util'
import { ServerError } from '../../../error'

const router = express.Router()

// EXECUTE TRANSACTIONS
// -------------------

router.post('/:did', async (req, res) => {
  const validate = util.parseBooleanParam(req.query.validate, true)
  const { did } = req.params
  const tx = util.checkReqBody(req.body, batchWriteParams)
  const db = util.getDB(res)
  if (validate) {
    for (const write of tx.writes) {
      if (write.action === 'create' || write.action === 'update') {
        if (!db.canIndexRecord(write.collection, write.value)) {
          throw new ServerError(
            400,
            `Not a valid record for collection: ${write.collection}`,
          )
        }
      }
    }
  }
  // @TODO add user auth here!
  const serverKey = util.getKeypair(res)
  const authStore = await auth.AuthStore.fromTokens(serverKey, [])
  const repo = await util.loadRepo(res, did, authStore)
  const prevCid = repo.cid
  await repo.batchWrite(tx.writes)
  // @TODO: do something better here instead of rescanning for diff
  const diff = await repo.verifySetOfUpdates(prevCid, repo.cid)
  try {
    await repoDiff.processDiff(db, repo, diff)
  } catch (err) {
    if (validate) {
      throw new ServerError(400, `Could not index record: ${err}`)
    }
  }
  await db.setRepoRoot(did, repo.cid)
  res.sendStatus(200)
})

router.post('/:did/c/:namespace/:dataset', async (req, res) => {
  const validate = util.parseBooleanParam(req.query.validate, true)
  const { did, namespace, dataset } = req.params
  const collection = `${namespace}/${dataset}`
  if (!req.body) {
    throw new ServerError(400, 'Record expected in request body')
  }
  const db = util.getDB(res)
  if (validate) {
    if (!db.canIndexRecord(collection, req.body)) {
      throw new ServerError(
        400,
        `Not a valid record for collection: ${collection}`,
      )
    }
  }
  const serverKey = util.getKeypair(res)
  const authStore = await auth.AuthStore.fromTokens(serverKey, [])
  const repo = await util.loadRepo(res, did, authStore)
  const tid = await repo.getCollection(collection).createRecord(req.body)
  const uri = new AdxUri(`${did}/${collection}/${tid.toString()}`)
  try {
    await db.indexRecord(uri, req.body)
  } catch (err) {
    if (validate) {
      throw new ServerError(400, `Could not index record: ${err}`)
    }
  }
  await db.setRepoRoot(did, repo.cid)
  // @TODO update subscribers
  res.json({ uri: uri.toString() })
})

router.put('/:did/c/:namespace/:dataset/r/:tid', async (req, res) => {
  const validate = util.parseBooleanParam(req.query.validate, true)
  const { did, namespace, dataset, tid } = req.params
  const collection = `${namespace}/${dataset}`
  if (!req.body) {
    throw new ServerError(400, 'Record expected in request body')
  }
  const db = util.getDB(res)
  if (validate) {
    if (!db.canIndexRecord(collection, req.body)) {
      throw new ServerError(
        400,
        `Not a valid record for collection: ${collection}`,
      )
    }
  }
  const serverKey = util.getKeypair(res)
  const authStore = await auth.AuthStore.fromTokens(serverKey, [])
  const repo = await util.loadRepo(res, did, authStore)
  await repo.getCollection(collection).updateRecord(TID.fromStr(tid), req.body)
  const uri = new AdxUri(`${did}/${collection}/${tid.toString()}`)
  try {
    await db.indexRecord(uri, req.body)
  } catch (err) {
    if (validate) {
      throw new ServerError(400, `Could not index record: ${err}`)
    }
  }
  await db.setRepoRoot(did, repo.cid)
  // @TODO update subscribers
  res.json({ uri: uri.toString() })
})

router.delete('/:did/c/:namespace/:dataset/r/:tid', async (req, res) => {
  const { did, namespace, dataset, tid } = req.params
  const collection = `${namespace}/${dataset}`
  const db = util.getDB(res)
  const serverKey = util.getKeypair(res)
  const authStore = await auth.AuthStore.fromTokens(serverKey, [])
  const repo = await util.loadRepo(res, did, authStore)
  await repo.getCollection(collection).deleteRecord(TID.fromStr(tid))
  const uri = new AdxUri(`${did}/${collection}/${tid.toString()}`)
  await db.deleteRecord(uri)
  await db.setRepoRoot(did, repo.cid)
  // @TODO update subscribers
  res.sendStatus(200)
})

// DESCRIBE REPO
// -------------

// @TODO move to a utility file
// @TODO: don't think we want to call out to did sdk here 🤔
async function resolveDidWrapped(did: string) {
  try {
    return (await didSdk.resolve(did)).didDoc
  } catch (e) {
    throw new DidResolutionFailed(did)
  }
}

async function resolveNameWrapped(name: string) {
  try {
    return await resolveName(name)
  } catch (e) {
    throw new NameResolutionFailed(name)
  }
}

router.get('/:nameOrDid', async (req, res) => {
  const { nameOrDid } = req.params
  const { confirmName } = util.checkReqBody(req.query, describeRepoParams)

  let name: string
  let did: string
  let didDoc: didSdk.DIDDocument
  let nameIsCorrect: boolean | undefined

  // @TODO add back once we have a did network
  // if (nameOrDid.startsWith('did:')) {
  //   did = nameOrDid
  //   didDoc = await resolveDidWrapped(did)
  //   name = 'undefined' // TODO: need to decide how username gets published in the did doc
  //   if (confirmName) {
  //     const namesDeclaredDid = await resolveNameWrapped(name)
  //     nameIsCorrect = did === namesDeclaredDid
  //   }
  // } else {
  //   name = nameOrDid
  //   did = await resolveNameWrapped(name)
  //   didDoc = await resolveDidWrapped(did)
  //   if (confirmName) {
  //     const didsDeclaredName = 'undefined' // TODO: need to decide how username gets published in the did doc
  //     nameIsCorrect = name === didsDeclaredName
  //   }
  // }

  const db = util.getDB(res)
  if (nameOrDid.startsWith('did:')) {
    did = nameOrDid
    const found = await db.getUsernameForDid(did)
    if (found === null) {
      throw new ServerError(404, 'Could not find username for did')
    }
    name = found
  } else {
    name = nameOrDid
    const found = await db.getDidForUsername(name)
    if (found === null) {
      throw new ServerError(404, 'Could not find did for username')
    }
    did = found
  }
  didDoc = {} as any
  nameIsCorrect = true

  const collections = await db.listCollectionsForDid(did)

  const resBody: DescribeRepoResponse = {
    name,
    did,
    didDoc,
    collections,
    nameIsCorrect,
  }
  res.json(resBody)
})

// LIST RECORDS
// ------------

router.get('/:nameOrDid/c/:namespace/:dataset', async (req, res) => {
  const { nameOrDid, namespace, dataset } = req.params
  const coll = namespace + '/' + dataset
  const {
    limit = 50,
    before,
    after,
    reverse = false,
  } = util.checkReqBody(req.query, listRecordsParams)

  const db = util.getDB(res)
  const did = nameOrDid.startsWith('did:')
    ? nameOrDid
    : await db.getDidForUsername(nameOrDid)
  if (!did) {
    throw new ServerError(404, `Could not find did for ${nameOrDid}`)
  }

  const records = await db.listRecordsForCollection(
    did,
    coll,
    limit,
    reverse,
    before,
    after,
  )

  res.json({ records } as ListRecordsResponse)
})

// GET RECORD
// ----------

router.get('/:nameOrDid/c/:namespace/:dataset/r/:tid', async (req, res) => {
  const { nameOrDid, namespace, dataset, tid } = req.params
  const coll = namespace + '/' + dataset

  const did = nameOrDid.startsWith('did:')
    ? nameOrDid
    : await resolveNameWrapped(nameOrDid)
  const uri = new AdxUri(`${did}/${coll}/${tid}`)

  const db = util.getDB(res)
  const record = await db.getRecord(uri)
  if (record === null) {
    throw new ServerError(404, `Could not locate record: ${uri}`)
  }
  res.json({ uri: uri.toString(), value: record } as GetRecordResponse)
})

export default router
