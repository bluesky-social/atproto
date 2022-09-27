import { Server } from '../../../lexicon'
import { InvalidRequestError, AuthRequiredError } from '@adxp/xrpc-server'
import { resolveName, TID } from '@adxp/common'
import { AdxUri } from '@adxp/uri'
import * as didSdk from '@adxp/did-sdk'
import * as repoDiff from '../../../repo-diff'
import * as util from '../../../util'

async function resolveNameWrapped(name: string) {
  try {
    return await resolveName(name)
  } catch (e) {
    throw new InvalidRequestError(`Failed to resolve name: ${name}`)
  }
}

export default function (server: Server) {
  server.todo.adx.repoDescribe(async (params, _in, _req, res) => {
    const { nameOrDid } = params

    let name: string
    let did: string
    // let didDoc: didSdk.DIDDocument
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
    const user = await db.getUser(nameOrDid)
    if (user === null) {
      throw new InvalidRequestError(`Could not find user: ${nameOrDid}`)
    }
    const didDoc = {} as any
    nameIsCorrect = true

    const collections = await db.listCollectionsForDid(user.did)

    return {
      encoding: 'application/json',
      body: {
        name: user.username,
        did: user.did,
        didDoc,
        collections,
        nameIsCorrect,
      },
    }
  })

  server.todo.adx.repoListRecords(async (params, _in, _req, res) => {
    const { nameOrDid, type, limit, before, after, reverse } = params

    const db = util.getDB(res)
    const did = nameOrDid.startsWith('did:')
      ? nameOrDid
      : (await db.getUser(nameOrDid))?.did
    if (!did) {
      throw new InvalidRequestError(`Could not find did for ${nameOrDid}`)
    }

    const records = await db.listRecordsForCollection(
      did,
      type,
      limit || 50,
      reverse || false,
      before,
      after,
    )

    return {
      encoding: 'application/json',
      body: { records: records as { uri: string; value: {} }[] },
    }
  })

  server.todo.adx.repoGetRecord(async (params, _in, _req, res) => {
    const { nameOrDid, type, tid } = params

    const did = nameOrDid.startsWith('did:')
      ? nameOrDid
      : await resolveNameWrapped(nameOrDid)
    const uri = new AdxUri(`${did}/${type}/${tid}`)

    const db = util.getDB(res)
    const record = await db.getRecord(uri)
    if (!record) {
      throw new InvalidRequestError(`Could not locate record: ${uri}`)
    }
    return {
      encoding: 'application/json',
      body: { uri: uri.toString(), value: record },
    }
  })

  server.todo.adx.repoBatchWrite(async (params, input, req, res) => {
    const { did, validate } = params
    const { auth, db } = util.getLocals(res)
    if (!auth.verifyUser(req, did)) {
      throw new AuthRequiredError()
    }
    const tx = input.body
    if (validate) {
      for (const write of tx.writes) {
        if (write.action === 'create' || write.action === 'update') {
          const validation = db.validateRecord(write.collection, write.value)
          if (!validation.valid) {
            throw new InvalidRequestError(
              `Invalid ${write.collection} record: ${validation.error}`,
            )
          }
        }
      }
    }
    const authStore = await util.getAuthstore(res)
    const repo = await util.maybeLoadRepo(res, did, authStore)
    if (!repo) {
      throw new InvalidRequestError(
        `${did} is not a registered repo on this server`,
      )
    }
    const prevCid = repo.cid
    await repo.batchWrite(tx.writes)
    // @TODO: do something better here instead of rescanning for diff
    const diff = await repo.verifySetOfUpdates(prevCid, repo.cid)
    try {
      await repoDiff.processDiff(db, repo, diff)
    } catch (err) {
      if (validate) {
        throw new InvalidRequestError(`Could not index record: ${err}`)
      }
    }
    await db.setRepoRoot(did, repo.cid)

    return {
      encoding: 'application/json',
      body: {},
    }
  })

  server.todo.adx.repoCreateRecord(async (params, input, req, res) => {
    const { did, type, validate } = params
    const { auth, db } = util.getLocals(res)
    if (!auth.verifyUser(req, did)) {
      throw new AuthRequiredError()
    }
    if (validate) {
      const validation = db.validateRecord(type, input.body)
      if (!validation.valid) {
        throw new InvalidRequestError(
          `Invalid ${type} record: ${validation.error}`,
        )
      }
    }
    const authStore = await util.getAuthstore(res)
    const repo = await util.maybeLoadRepo(res, did, authStore)
    if (!repo) {
      throw new InvalidRequestError(
        `${did} is not a registered repo on this server`,
      )
    }
    const tid = await repo.getCollection(type).createRecord(input.body)
    const uri = new AdxUri(`${did}/${type}/${tid.toString()}`)
    try {
      await db.indexRecord(uri, input.body)
    } catch (err) {
      if (validate) {
        throw new InvalidRequestError(`Could not index record: ${err}`)
      }
    }
    await db.setRepoRoot(did, repo.cid)
    // @TODO update subscribers

    return {
      encoding: 'application/json',
      body: { uri: uri.toString() },
    }
  })

  server.todo.adx.repoPutRecord(async (params, input, req, res) => {
    const { did, type, tid, validate } = params
    const { auth, db } = util.getLocals(res)
    if (!auth.verifyUser(req, did)) {
      throw new AuthRequiredError()
    }
    if (validate) {
      const validation = db.validateRecord(type, input.body)
      if (!validation.valid) {
        throw new InvalidRequestError(
          `Invalid ${type} record: ${validation.error}`,
        )
      }
    }
    const authStore = await util.getAuthstore(res)
    const repo = await util.maybeLoadRepo(res, did, authStore)
    if (!repo) {
      throw new InvalidRequestError(
        `${did} is not a registered repo on this server`,
      )
    }
    await repo.getCollection(type).updateRecord(TID.fromStr(tid), input.body)
    const uri = new AdxUri(`${did}/${type}/${tid.toString()}`)
    try {
      await db.indexRecord(uri, input.body)
    } catch (err) {
      if (validate) {
        throw new InvalidRequestError(`Could not index record: ${err}`)
      }
    }
    await db.setRepoRoot(did, repo.cid)
    // @TODO update subscribers
    return {
      encoding: 'application/json',
      body: { uri: uri.toString() },
    }
  })

  server.todo.adx.repoDeleteRecord(async (params, _input, req, res) => {
    const { did, type, tid } = params
    const { auth, db } = util.getLocals(res)
    if (!auth.verifyUser(req, did)) {
      throw new AuthRequiredError()
    }
    const authStore = await util.getAuthstore(res)
    const repo = await util.maybeLoadRepo(res, did, authStore)
    if (!repo) {
      throw new InvalidRequestError(
        `${did} is not a registered repo on this server`,
      )
    }
    await repo.getCollection(type).deleteRecord(TID.fromStr(tid))
    const uri = new AdxUri(`${did}/${type}/${tid.toString()}`)
    await db.deleteRecord(uri)
    await db.setRepoRoot(did, repo.cid)
    // @TODO update subscribers
  })
}
