import express from 'express'
import {
  NameResolutionFailed,
  DidResolutionFailed,
  describeRepoParams,
  DescribeRepoResponse,
  listRecordsParams,
  batchWriteParams,
} from '@adxp/api'
import { resolveName, AdxUri } from '@adxp/common'
import * as didSdk from '@adxp/did-sdk'

import * as util from '../../../util'
import { ServerError } from '../../../error'

const router = express.Router()

// EXECUTE TRANSACTION
// -------------------
router.post('/:did', async (req, res) => {
  const { did } = req.params
  const tx = util.checkReqBody(req.body, batchWriteParams)
  // @TODO add user auth here!
  const serverKey = util.getKeypair(res)
  const repo = await util.loadRepo(res, did, {} as any) //@TODO need to add server auth store here
  await repo.batchWrite(tx.writes)
  res.status(200).send()
})

// DESCRIBE REPO
// -------------

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

  const db = util.getDB(res)
  const collections = await db.listCollectionsForDid(did)

  const resBody: DescribeRepoResponse = {
    name,
    did,
    didDoc,
    collections,
    nameIsCorrect,
  }
  res.status(200)
  res.json(resBody)
})

// LIST RECORDS
// ------------

router.get('/:nameOrDid/c/:coll', async (req, res) => {
  const { nameOrDid, coll } = req.params
  const { count = 50, from } = util.checkReqBody(req.query, listRecordsParams)
  const db = util.getDB(res)
  const did = nameOrDid.startsWith('did:')
    ? nameOrDid
    : await resolveNameWrapped(nameOrDid)

  const records = await db.listRecordsForCollection(did, coll, count, from)
  res.status(200).send(records)
})

// GET RECORD
// ----------

router.get('/:nameOrDid/c/:coll/r/:recordKey', async (req, res) => {
  const { nameOrDid, coll, recordKey } = req.params

  const did = nameOrDid.startsWith('did:')
    ? nameOrDid
    : await resolveNameWrapped(nameOrDid)
  const uri = new AdxUri(`${did}/${coll}/${recordKey}`)

  const db = util.getDB(res)
  const record = await db.getRecord(uri)
  if (record === null) {
    throw new ServerError(404, `Could not locate record: ${uri}`)
  }
  res.status(200).send(record)
})

export default router
