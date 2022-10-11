import { Server } from '../../../lexicon'
import { InvalidRequestError, AuthRequiredError } from '@adxp/xrpc-server'
import { TID } from '@adxp/common'
import { AdxUri } from '@adxp/uri'
import * as didResolver from '@adxp/did-resolver'
import * as repoDiff from '../../../repo-diff'
import * as locals from '../../../locals'

export default function (server: Server) {
  server.todo.adx.repoDescribe(async (params, _in, _req, res) => {
    const { nameOrDid } = params

    const { db, auth } = locals.get(res)
    const user = await db.getUser(nameOrDid)
    if (user === null) {
      throw new InvalidRequestError(`Could not find user: ${nameOrDid}`)
    }

    let didDoc
    try {
      didDoc = await auth.didResolver.ensureResolveDid(user.did)
    } catch (err) {
      throw new InvalidRequestError(`Could not resolve DID: ${err}`)
    }

    const username = didResolver.getUsername(didDoc)
    const nameIsCorrect = username === user.username

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
    const { nameOrDid, collection, limit, before, after, reverse } = params

    const db = locals.db(res)
    const did = await db.getUserDid(nameOrDid)
    if (!did) {
      throw new InvalidRequestError(`Could not find user: ${nameOrDid}`)
    }

    const records = await db.listRecordsForCollection(
      did,
      collection,
      limit || 50,
      reverse || false,
      before,
      after,
    )

    return {
      encoding: 'application/json',
      body: {
        records,
      },
    }
  })

  server.todo.adx.repoGetRecord(async (params, _in, _req, res) => {
    const { nameOrDid, collection, recordKey, cid = null } = params
    const db = locals.db(res)

    const did = await db.getUserDid(nameOrDid)
    if (!did) {
      throw new InvalidRequestError(`Could not find user: ${nameOrDid}`)
    }

    const uri = new AdxUri(`${did}/${collection}/${recordKey}`)

    const record = await db.getRecord(uri, cid)
    if (!record) {
      throw new InvalidRequestError(`Could not locate record: ${uri}`)
    }
    return {
      encoding: 'application/json',
      body: record,
    }
  })

  // @TODO all write methods should be transactional to ensure no forked histories
  server.todo.adx.repoBatchWrite(async (params, input, req, res) => {
    const { did, validate } = params
    const { auth, db, logger } = locals.get(res)
    if (!auth.verifyUser(req, did)) {
      throw new AuthRequiredError()
    }
    const tx = input.body
    const update = tx.writes.findIndex((write) => write.action === 'update')
    if (update > -1) {
      throw new InvalidRequestError(`Updates are not yet supported.`)
    }
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
    const repo = await locals.loadRepo(res, did)
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
      logger.warn({ did, err }, 'failed to index batch write')
      if (validate) {
        throw new InvalidRequestError(`Could not index record: ${err}`)
      }
    }
    await db.updateRepoRoot(did, repo.cid)

    return {
      encoding: 'application/json',
      body: {},
    }
  })

  server.todo.adx.repoCreateRecord(async (params, input, req, res) => {
    const { did, collection, validate } = params
    const { auth, db, logger } = locals.get(res)
    if (!auth.verifyUser(req, did)) {
      throw new AuthRequiredError()
    }
    if (validate) {
      const validation = db.validateRecord(collection, input.body)
      if (!validation.valid) {
        throw new InvalidRequestError(
          `Invalid ${collection} record: ${validation.error}`,
        )
      }
    }
    const repo = await locals.loadRepo(res, did)
    if (!repo) {
      throw new InvalidRequestError(
        `${did} is not a registered repo on this server`,
      )
    }
    const { key, cid } = await repo
      .getCollection(collection)
      .createRecord(input.body)
    const uri = new AdxUri(`${did}/${collection}/${key}`)
    try {
      await db.indexRecord(uri, cid, input.body)
    } catch (err) {
      logger.warn(
        { uri: uri.toString(), err, validate },
        'failed to index new record',
      )
      if (validate) {
        throw new InvalidRequestError(`Could not index record: ${err}`)
      }
    }
    await db.updateRepoRoot(did, repo.cid)
    // @TODO update subscribers

    return {
      encoding: 'application/json',
      body: { uri: uri.toString(), cid: cid.toString() },
    }
  })

  server.todo.adx.repoPutRecord(async (_params, _input, _req, _res) => {
    throw new InvalidRequestError(`Updates are not yet supported.`)
  })

  server.todo.adx.repoDeleteRecord(async (params, _input, req, res) => {
    const { did, type, tid } = params
    const { auth, db, logger } = locals.get(res)
    if (!auth.verifyUser(req, did)) {
      throw new AuthRequiredError()
    }
    const repo = await locals.loadRepo(res, did)
    if (!repo) {
      throw new InvalidRequestError(
        `${did} is not a registered repo on this server`,
      )
    }
    await repo.getCollection(type).deleteRecord(TID.fromStr(tid))
    const uri = new AdxUri(`${did}/${type}/${tid.toString()}`)
    try {
      await db.deleteRecord(uri)
    } catch (err) {
      logger.warn(
        { uri: uri.toString(), err },
        'failed to delete indexed record',
      )
    }
    await db.updateRepoRoot(did, repo.cid)
    // @TODO update subscribers
  })
}
