import { Server } from '../../../lexicon'
import { InvalidRequestError, AuthRequiredError } from '@atproto/xrpc-server'
import { AtUri } from '@atproto/uri'
import * as didResolver from '@atproto/did-resolver'
import { DeleteOp, RecordCreateOp } from '@atproto/repo'
import * as locals from '../../../locals'
import { TID } from '@atproto/common'
import * as repo from '../../../repo'
import ServerAuth from '../../../auth'
import {
  InvalidRecordError,
  PreparedCreate,
  PreparedWrites,
} from '../../../repo'

export default function (server: Server) {
  server.com.atproto.repo.describe(async ({ params, res }) => {
    const { user } = params

    const { db, auth, services } = locals.get(res)
    const userObj = await services.actor(db).getUser(user)
    if (userObj === null) {
      throw new InvalidRequestError(`Could not find user: ${user}`)
    }

    let didDoc
    try {
      didDoc = await auth.didResolver.ensureResolveDid(userObj.did)
    } catch (err) {
      throw new InvalidRequestError(`Could not resolve DID: ${err}`)
    }

    const handle = didResolver.getHandle(didDoc)
    const handleIsCorrect = handle === userObj.handle

    const collections = await services
      .record(db)
      .listCollectionsForDid(userObj.did)

    return {
      encoding: 'application/json',
      body: {
        handle: userObj.handle,
        did: userObj.did,
        didDoc,
        collections,
        handleIsCorrect,
      },
    }
  })

  server.com.atproto.repo.listRecords(async ({ params, res }) => {
    const { user, collection, limit, before, after, reverse } = params

    const { db, services } = locals.get(res)
    const did = await services.actor(db).getDidForActor(user)
    if (!did) {
      throw new InvalidRequestError(`Could not find user: ${user}`)
    }

    const records = await services
      .record(db)
      .listRecordsForCollection(
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

  server.com.atproto.repo.getRecord(async ({ params, res }) => {
    const { user, collection, rkey, cid } = params
    const { db, services } = locals.get(res)

    const did = await services.actor(db).getDidForActor(user)
    if (!did) {
      throw new InvalidRequestError(`Could not find user: ${user}`)
    }

    const uri = new AtUri(`${did}/${collection}/${rkey}`)

    const record = await services.record(db).getRecord(uri, cid || null)
    if (!record) {
      throw new InvalidRequestError(`Could not locate record: ${uri}`)
    }
    return {
      encoding: 'application/json',
      body: record,
    }
  })

  server.com.atproto.repo.batchWrite({
    auth: ServerAuth.verifier,
    handler: async ({ input, auth, res }) => {
      const tx = input.body
      const { did, validate } = tx
      const { db, services } = locals.get(res)
      const requester = auth.credentials.did
      const authorized = await services
        .repo(db)
        .isUserControlledRepo(did, requester)
      if (!authorized) {
        throw new AuthRequiredError()
      }

      const authStore = locals.getAuthstore(res, did)
      const hasUpdate = tx.writes.some((write) => write.action === 'update')
      if (hasUpdate) {
        throw new InvalidRequestError(`Updates are not yet supported.`)
      }

      let writes: PreparedWrites
      try {
        writes = await repo.prepareWrites(
          did,
          tx.writes.map((write) => {
            if (write.action === 'create') {
              return {
                ...write,
                rkey: write.rkey || TID.nextStr(),
              } as RecordCreateOp
            } else if (write.action === 'delete') {
              return write as DeleteOp
            } else {
              throw new InvalidRequestError(
                `Action not supported: ${write.action}`,
              )
            }
          }),
          validate,
        )
      } catch (err) {
        if (err instanceof InvalidRecordError) {
          throw new InvalidRequestError(err.message)
        }
        throw err
      }

      await db.transaction(async (dbTxn) => {
        const now = new Date().toISOString()
        const repoTxn = services.repo(dbTxn)
        await repoTxn.processWrites(did, authStore, writes, now)
      })
    },
  })

  server.com.atproto.repo.createRecord({
    auth: ServerAuth.verifier,
    handler: async ({ input, auth, res }) => {
      const { did, collection, record } = input.body
      const validate =
        typeof input.body.validate === 'boolean' ? input.body.validate : true
      const { db, services } = locals.get(res)
      const requester = auth.credentials.did
      const authorized = await services
        .repo(db)
        .isUserControlledRepo(did, requester)
      if (!authorized) {
        throw new AuthRequiredError()
      }
      const authStore = locals.getAuthstore(res, did)

      // determine key type. if undefined, repo assigns a TID
      const rkey = repo.determineRkey(collection)

      const now = new Date().toISOString()
      let write: PreparedCreate
      try {
        write = await repo.prepareCreate(
          did,
          {
            action: 'create',
            collection,
            rkey,
            value: record,
          },
          validate,
        )
      } catch (err) {
        if (err instanceof InvalidRecordError) {
          throw new InvalidRequestError(err.message)
        }
        throw err
      }

      await db.transaction(async (dbTxn) => {
        const repoTxn = services.repo(dbTxn)
        await repoTxn.processWrites(did, authStore, [write], now)
      })

      return {
        encoding: 'application/json',
        body: { uri: write.uri.toString(), cid: write.cid.toString() },
      }
    },
  })

  server.com.atproto.repo.putRecord(async () => {
    throw new InvalidRequestError(`Updates are not yet supported.`)
  })

  server.com.atproto.repo.deleteRecord({
    auth: ServerAuth.verifier,
    handler: async ({ input, auth, res }) => {
      const { did, collection, rkey } = input.body
      const { db, services } = locals.get(res)
      const requester = auth.credentials.did
      const authorized = await services
        .repo(db)
        .isUserControlledRepo(did, requester)
      if (!authorized) {
        throw new AuthRequiredError()
      }

      const authStore = locals.getAuthstore(res, did)
      const now = new Date().toISOString()

      const write = await repo.prepareWrites(did, {
        action: 'delete',
        collection,
        rkey,
      })

      await db.transaction(async (dbTxn) => {
        const repoTxn = services.repo(dbTxn)
        await repoTxn.processWrites(did, authStore, write, now)
      })
    },
  })
}
