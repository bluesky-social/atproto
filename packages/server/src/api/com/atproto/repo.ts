import { Server } from '../../../lexicon'
import { InvalidRequestError, AuthRequiredError } from '@atproto/xrpc-server'
import { AtUri } from '@atproto/uri'
import * as didResolver from '@atproto/did-resolver'
import * as locals from '../../../locals'
import * as schemas from '../../../lexicon/schemas'
import { TID } from '@atproto/common'
import { CidWriteOp, RepoStructure } from '@atproto/repo'

export default function (server: Server) {
  server.com.atproto.repoDescribe(async (params, _in, _req, res) => {
    const { user } = params

    const { db, auth } = locals.get(res)
    const userObj = await db.getUser(user)
    if (userObj === null) {
      throw new InvalidRequestError(`Could not find user: ${user}`)
    }

    let didDoc
    try {
      didDoc = await auth.didResolver.ensureResolveDid(userObj.did)
    } catch (err) {
      throw new InvalidRequestError(`Could not resolve DID: ${err}`)
    }

    const username = didResolver.getUsername(didDoc)
    const nameIsCorrect = username === userObj.username

    const collections = await db.listCollectionsForDid(userObj.did)

    return {
      encoding: 'application/json',
      body: {
        name: userObj.username,
        did: userObj.did,
        didDoc,
        collections,
        nameIsCorrect,
      },
    }
  })

  server.com.atproto.repoListRecords(async (params, _in, _req, res) => {
    const { user, collection, limit, before, after, reverse } = params

    const db = locals.db(res)
    const did = await db.getUserDid(user)
    if (!did) {
      throw new InvalidRequestError(`Could not find user: ${user}`)
    }

    const records = await db.listRecordsForCollection(
      did,
      collection,
      limit || 50,
      reverse || false,
      before,
      after,
    )

    const lastRecord = records.at(-1)
    const lastUri = lastRecord && new AtUri(lastRecord?.uri)

    return {
      encoding: 'application/json',
      body: {
        records,
        // Paginate with `before` by default, paginate with `after` when using `reverse`.
        cursor: lastUri?.rkey,
      },
    }
  })

  server.com.atproto.repoGetRecord(async (params, _in, _req, res) => {
    const { user, collection, rkey, cid } = params
    const db = locals.db(res)

    const did = await db.getUserDid(user)
    if (!did) {
      throw new InvalidRequestError(`Could not find user: ${user}`)
    }

    const uri = new AtUri(`${did}/${collection}/${rkey}`)

    const record = await db.getRecord(uri, cid || null)
    if (!record) {
      throw new InvalidRequestError(`Could not locate record: ${uri}`)
    }
    return {
      encoding: 'application/json',
      body: record,
    }
  })

  server.com.atproto.repoBatchWrite(async (params, input, req, res) => {
    const { did, validate } = params
    const { auth, db, blockstore, logger } = locals.get(res)
    if (!auth.verifyUser(req, did)) {
      throw new AuthRequiredError()
    }
    const authStore = locals.getAuthstore(res, did)
    const tx = input.body
    const hasUpdate = tx.writes.some((write) => write.action === 'update')
    if (hasUpdate) {
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
    await db.transaction(async (dbTxn) => {
      const currRoot = await dbTxn.getRepoRoot(did, true)
      if (!currRoot) {
        throw new InvalidRequestError(
          `${did} is not a registered repo on this server`,
        )
      }
      const cidWriteOps: CidWriteOp[] = await Promise.all(
        tx.writes.map(async (write) => {
          if (write.action === 'create') {
            const cid = await blockstore.put(write.value)
            const rkey = write.rkey || TID.nextStr()
            const uri = new AtUri(`${did}/${write.collection}/${rkey}`)
            await dbTxn.indexRecord(uri, cid, write.value)
            return {
              action: 'create',
              collection: write.collection,
              rkey,
              cid,
            }
          } else if (write.action === 'delete') {
            const uri = new AtUri(`${did}/${write.collection}/${write.rkey}`)
            await dbTxn.deleteRecord(uri)
            return write
          } else {
            throw new InvalidRequestError(
              `Action not supported: ${write.action}`,
            )
          }
        }),
      )

      const repo = await RepoStructure.load(blockstore, currRoot)
      await repo
        .stageUpdate(cidWriteOps)
        .createCommit(authStore, async (prev, curr) => {
          const success = await db.updateRepoRoot(did, curr, prev)
          if (!success) {
            logger.error({ did, curr, prev }, 'repo update failed')
            throw new Error('Could not update repo root')
          }
          return null
        })
    })

    return {
      encoding: 'application/json',
      body: {},
    }
  })

  server.com.atproto.repoCreateRecord(async (params, input, req, res) => {
    const { did, collection, validate } = params
    const { auth, db, blockstore, logger } = locals.get(res)
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
    const authStore = locals.getAuthstore(res, did)

    // determine key type. if undefined, repo assigns a TID
    const keyType = schemas.recordSchemaDict[collection]?.key
    let rkey: string
    if (keyType && keyType.startsWith('literal')) {
      const split = keyType.split(':')
      rkey = split[1]
    } else {
      rkey = TID.nextStr()
    }

    const cid = await blockstore.put(input.body)
    const uri = new AtUri(`${did}/${collection}/${rkey}`)

    await db.transaction(async (txn) => {
      const currRoot = await txn.getRepoRoot(did, true)
      if (!currRoot) {
        throw new InvalidRequestError(
          `${did} is not a registered repo on this server`,
        )
      }
      try {
        await txn.indexRecord(uri, cid, input.body)
      } catch (err) {
        logger.warn(
          { uri: uri.toString(), err, validate },
          'failed to index new record',
        )
        if (validate) {
          throw new InvalidRequestError(`Could not index record: ${err}`)
        }
      }

      const repo = await RepoStructure.load(blockstore, currRoot)
      await repo
        .stageUpdate({
          action: 'create',
          collection,
          rkey,
          cid,
        })
        .createCommit(authStore, async (prev, curr) => {
          const success = await txn.updateRepoRoot(did, curr, prev)
          if (!success) {
            logger.error({ did, curr, prev }, 'repo update failed')
            throw new Error('Could not update repo root')
          }
          return null
        })
    })

    return {
      encoding: 'application/json',
      body: { uri: uri.toString(), cid: cid.toString() },
    }
  })

  server.com.atproto.repoPutRecord(async (_params, _input, _req, _res) => {
    throw new InvalidRequestError(`Updates are not yet supported.`)
  })

  server.com.atproto.repoDeleteRecord(async (params, _input, req, res) => {
    const { did, collection, rkey } = params
    const { auth, db, blockstore, logger } = locals.get(res)
    if (!auth.verifyUser(req, did)) {
      throw new AuthRequiredError()
    }
    const authStore = locals.getAuthstore(res, did)
    const uri = new AtUri(`${did}/${collection}/${rkey}`)

    await db.transaction(async (txn) => {
      const currRoot = await txn.getRepoRoot(did, true)
      if (!currRoot) {
        throw new InvalidRequestError(
          `${did} is not a registered repo on this server`,
        )
      }
      await txn.deleteRecord(uri)

      const repo = await RepoStructure.load(blockstore, currRoot)
      await repo
        .stageUpdate({
          action: 'delete',
          collection,
          rkey,
        })
        .createCommit(authStore, async (prev, curr) => {
          const success = await txn.updateRepoRoot(did, curr, prev)
          if (!success) {
            logger.error({ did, curr, prev }, 'repo update failed')
            throw new Error('Could not update repo root')
          }
          return null
        })
    })
  })
}
