import { Server, APP_BSKY } from '../../../lexicon'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { PlcClient } from '@atproto/plc'
import * as crypto from '@atproto/crypto'
import * as handleLib from '@atproto/handle'
import * as locals from '../../../locals'
import * as schema from '../../../lexicon/schemas'
import { AtUri } from '@atproto/uri'
import { RepoStructure } from '@atproto/repo'
import SqlBlockstore from '../../../sql-blockstore'
import { UserAlreadyExistsError } from '../../../db'

export default function (server: Server) {
  server.app.bsky.createScene(async (_params, input, req, res) => {
    const { db, auth, config, keypair, logger } = locals.get(res)
    const { recoveryKey } = input.body

    const requester = auth.getUserDid(req)
    if (!requester) {
      throw new AuthRequiredError()
    }

    const handle = input.body.handle.toLowerCase()

    try {
      handleLib.ensureValid(handle, config.availableUserDomains)
    } catch (err) {
      if (err instanceof handleLib.InvalidHandleError) {
        throw new InvalidRequestError(err.message, 'InvalidHandle')
      }
      throw err
    }

    // In order to perform the significant db updates ahead of
    // registering the did, we will use a temp invalid did. Once everything
    // goes well and a fresh did is registered, we'll replace the temp values.
    const tempDid = crypto.randomStr(16, 'base32')
    const now = new Date().toISOString()

    const result = await db.transaction(async (dbTxn) => {
      // Pre-register before going out to PLC to get a real did
      try {
        await dbTxn.preregisterDid(handle, tempDid)
      } catch (err) {
        if (err instanceof UserAlreadyExistsError) {
          throw new InvalidRequestError(
            `Handle already taken: ${handle}`,
            'HandleNotAvailable',
          )
        }
        throw err
      }

      // Generate a real did with PLC
      const plcClient = new PlcClient(config.didPlcUrl)
      let did: string
      try {
        did = await plcClient.createDid(
          keypair,
          recoveryKey || config.recoveryKey,
          handle,
          config.publicUrl,
        )
      } catch (err) {
        logger.error(
          { didKey: keypair.did(), handle },
          'failed to create did:plc',
        )
        throw err
      }

      // Now that we have a real did, we now replace the tempDid
      // and setup the repo root. This _should_ succeed under typical conditions.
      await dbTxn.finalizeDid(handle, did, tempDid)
      await dbTxn.db
        .insertInto('scene')
        .values({ handle, creator: requester, createdAt: now })
        .execute()

      const authStore = locals.getAuthstore(res, did)
      const blockstore = new SqlBlockstore(dbTxn, did, now)
      const repo = await RepoStructure.create(blockstore, did, authStore)

      const declaration = {
        $type: 'app.bsky.declaration',
        actorType: APP_BSKY.ActorScene,
      }
      const declarationCid = await blockstore.put(declaration)
      const uri = new AtUri(`${did}/${schema.ids.AppBskyDeclaration}/self`)

      await repo
        .stageUpdate({
          action: 'create',
          collection: uri.collection,
          rkey: uri.rkey,
          cid: declarationCid,
        })
        .createCommit(authStore, async (_prev, curr) => {
          await dbTxn.db
            .insertInto('repo_root')
            .values({
              did: did,
              root: curr.toString(),
              indexedAt: now,
            })
            .execute()
          return null
        })
      return { did, declarationCid }
    })

    return {
      encoding: 'application/json',
      body: {
        handle,
        did: result.did,
        declarationCid: result.declarationCid.toString(),
      },
    }
  })
}
