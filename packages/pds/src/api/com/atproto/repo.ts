import { Server } from '../../../lexicon'
import { InvalidRequestError, AuthRequiredError } from '@atproto/xrpc-server'
import { LexRecord } from '@atproto/lexicon'
import { AtUri } from '@atproto/uri'
import * as didResolver from '@atproto/did-resolver'
import { DeleteOp, RecordCreateOp } from '@atproto/repo'
import * as locals from '../../../locals'
import { lexicons } from '../../../lexicon/lexicons'
import { TID } from '@atproto/common'
import * as repo from '../../../repo'
import ServerAuth from '../../../auth'

export default function (server: Server) {
  server.com.atproto.repo.describe(async ({ params, res }) => {
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

    const handle = didResolver.getHandle(didDoc)
    const handleIsCorrect = handle === userObj.handle

    const collections = await db.listCollectionsForDid(userObj.did)

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

    const db = locals.db(res)
    const did = await db.getDidForActor(user)
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

  server.com.atproto.repo.getRecord(async ({ params, res }) => {
    const { user, collection, rkey, cid } = params
    const db = locals.db(res)

    const did = await db.getDidForActor(user)
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

  server.com.atproto.repo.batchWrite({
    auth: ServerAuth.verifier,
    handler: async ({ input, auth, res }) => {
      const tx = input.body
      const { did, validate } = tx
      const { db, blobstore } = locals.get(res)
      const requester = auth.credentials.did
      const authorized = await db.isUserControlledRepo(did, requester)
      if (!authorized) {
        throw new AuthRequiredError()
      }

      const authStore = locals.getAuthstore(res, did)
      const hasUpdate = tx.writes.some((write) => write.action === 'update')
      if (hasUpdate) {
        throw new InvalidRequestError(`Updates are not yet supported.`)
      }
      if (validate) {
        for (const write of tx.writes) {
          if (write.action === 'create' || write.action === 'update') {
            try {
              db.assertValidRecord(write.collection, write.value)
            } catch (e) {
              throw new InvalidRequestError(
                `Invalid ${write.collection} record: ${
                  e instanceof Error ? e.message : String(e)
                }`,
              )
            }
          }
        }
      }

      const writes = await repo.prepareWrites(
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
      )

      await db.transaction(async (dbTxn) => {
        const now = new Date().toISOString()
        await repo.processWrites(dbTxn, did, authStore, blobstore, writes, now)
      })
    },
  })

  server.com.atproto.repo.createRecord({
    auth: ServerAuth.verifier,
    handler: async ({ input, auth, res }) => {
      const { did, collection, record } = input.body
      const validate =
        typeof input.body.validate === 'boolean' ? input.body.validate : true
      const { db, blobstore } = locals.get(res)
      const requester = auth.credentials.did
      const authorized = await db.isUserControlledRepo(did, requester)
      if (!authorized) {
        throw new AuthRequiredError()
      }

      if (validate) {
        try {
          db.assertValidRecord(collection, record)
        } catch (e) {
          throw new InvalidRequestError(
            `Invalid ${collection} record: ${
              e instanceof Error ? e.message : String(e)
            }`,
          )
        }
      }
      const authStore = locals.getAuthstore(res, did)

      // determine key type. if undefined, repo assigns a TID
      const keyType = (
        lexicons.getDefOrThrow(collection, ['record']) as LexRecord
      ).key
      let rkey: string
      if (keyType && keyType.startsWith('literal')) {
        const split = keyType.split(':')
        rkey = split[1]
      } else {
        rkey = TID.nextStr()
      }

      const now = new Date().toISOString()
      const write = await repo.prepareCreate(did, {
        action: 'create',
        collection,
        rkey,
        value: record,
      })

      await db.transaction(async (dbTxn) => {
        await repo.processWrites(dbTxn, did, authStore, blobstore, [write], now)
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
      const { db, blobstore } = locals.get(res)
      const requester = auth.credentials.did
      const authorized = await db.isUserControlledRepo(did, requester)
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
        await repo.processWrites(dbTxn, did, authStore, blobstore, write, now)
      })
    },
  })
}
