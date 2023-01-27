import { InvalidRequestError, AuthRequiredError } from '@atproto/xrpc-server'
import { AtUri } from '@atproto/uri'
import * as didResolver from '@atproto/did-resolver'
import * as repo from '../../../repo'
import { Server } from '../../../lexicon'
import {
  InvalidRecordError,
  PreparedCreate,
  PreparedWrite,
} from '../../../repo'
import AppContext from '../../../context'
import { WriteOpAction } from '@atproto/repo'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.repo.describe(async ({ params }) => {
    const { user } = params

    const userObj = await ctx.services.actor(ctx.db).getUser(user)
    if (userObj === null) {
      throw new InvalidRequestError(`Could not find user: ${user}`)
    }

    let didDoc
    try {
      didDoc = await ctx.auth.didResolver.ensureResolveDid(userObj.did)
    } catch (err) {
      throw new InvalidRequestError(`Could not resolve DID: ${err}`)
    }

    const handle = didResolver.getHandle(didDoc)
    const handleIsCorrect = handle === userObj.handle

    const collections = await ctx.services
      .record(ctx.db)
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

  server.com.atproto.repo.listRecords(async ({ params }) => {
    const { user, collection, limit, before, after, reverse } = params

    const did = await ctx.services.actor(ctx.db).getDidForActor(user)
    if (!did) {
      throw new InvalidRequestError(`Could not find user: ${user}`)
    }

    const records = await ctx.services
      .record(ctx.db)
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

  server.com.atproto.repo.getRecord(async ({ params }) => {
    const { user, collection, rkey, cid } = params

    const did = await ctx.services.actor(ctx.db).getDidForActor(user)
    if (!did) {
      throw new InvalidRequestError(`Could not find user: ${user}`)
    }

    const uri = new AtUri(`${did}/${collection}/${rkey}`)

    const record = await ctx.services.record(ctx.db).getRecord(uri, cid || null)
    if (!record) {
      throw new InvalidRequestError(`Could not locate record: ${uri}`)
    }
    return {
      encoding: 'application/json',
      body: record,
    }
  })

  server.com.atproto.repo.batchWrite({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ input, auth }) => {
      const tx = input.body
      const { did, validate } = tx
      const requester = auth.credentials.did
      if (did !== requester) {
        throw new AuthRequiredError()
      }
      if (validate === false) {
        throw new InvalidRequestError(
          'Unvalidated writes are not yet supported.',
        )
      }

      const hasUpdate = tx.writes.some(
        (write) => write.action === WriteOpAction.Update,
      )
      if (hasUpdate) {
        throw new InvalidRequestError(`Updates are not yet supported.`)
      }

      let writes: PreparedWrite[]
      try {
        writes = await Promise.all(
          tx.writes.map((write) => {
            if (write.action === WriteOpAction.Create) {
              return repo.prepareCreate({
                did,
                collection: write.collection,
                record: write.value,
                rkey: write.rkey,
                validate,
              })
            } else if (write.action === WriteOpAction.Delete) {
              return repo.prepareDelete({
                did,
                collection: write.collection,
                rkey: write.rkey,
              })
            } else {
              throw new InvalidRequestError(
                `Action not supported: ${write.action}`,
              )
            }
          }),
        )
      } catch (err) {
        if (err instanceof InvalidRecordError) {
          throw new InvalidRequestError(err.message)
        }
        throw err
      }

      await ctx.db.transaction(async (dbTxn) => {
        const now = new Date().toISOString()
        const repoTxn = ctx.services.repo(dbTxn)
        await repoTxn.processWrites(did, writes, now)
      })
    },
  })

  server.com.atproto.repo.createRecord({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ input, auth }) => {
      const { did, collection, record } = input.body
      const validate =
        typeof input.body.validate === 'boolean' ? input.body.validate : true
      const requester = auth.credentials.did
      if (did !== requester) {
        throw new AuthRequiredError()
      }
      if (validate === false) {
        throw new InvalidRequestError(
          'Unvalidated writes are not yet supported.',
        )
      }

      // determine key type. if undefined, repo assigns a TID
      const rkey = repo.determineRkey(collection)

      const now = new Date().toISOString()
      let write: PreparedCreate
      try {
        write = await repo.prepareCreate({
          did,
          collection,
          record,
          rkey,
          validate,
        })
      } catch (err) {
        if (err instanceof InvalidRecordError) {
          throw new InvalidRequestError(err.message)
        }
        throw err
      }

      await ctx.db.transaction(async (dbTxn) => {
        const repoTxn = ctx.services.repo(dbTxn)
        await repoTxn.processWrites(did, [write], now)
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
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ input, auth }) => {
      const { did, collection, rkey } = input.body
      const requester = auth.credentials.did
      if (did !== requester) {
        throw new AuthRequiredError()
      }

      const now = new Date().toISOString()
      const write = await repo.prepareDelete({ did, collection, rkey })
      await ctx.db.transaction(async (dbTxn) => {
        await ctx.services.repo(dbTxn).processWrites(did, [write], now)
      })
    },
  })
}
