import { Server, APP_BSKY_SYSTEM, APP_BSKY_GRAPH } from '../../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { PlcClient } from '@atproto/plc'
import * as crypto from '@atproto/crypto'
import * as handleLib from '@atproto/handle'
import * as locals from '../../../../locals'
import * as lex from '../../../../lexicon/lexicons'
import * as repo from '../../../../repo'
import ServerAuth from '../../../../auth'
import { UserAlreadyExistsError } from '../../../../services/actor'

export default function (server: Server) {
  server.app.bsky.actor.createScene({
    auth: ServerAuth.verifier,
    handler: async ({ auth, input, res }) => {
      const { db, services, config, keypair, logger } = locals.get(res)
      const { recoveryKey } = input.body
      const requester = auth.credentials.did

      let handle: string
      try {
        handle = handleLib.normalizeAndEnsureValid(
          input.body.handle,
          config.availableUserDomains,
        )
      } catch (err) {
        if (err instanceof handleLib.InvalidHandleError) {
          throw new InvalidRequestError(err.message, 'InvalidHandle')
        } else if (err instanceof handleLib.ReservedHandleError) {
          throw new InvalidRequestError(err.message, 'HandleNotAvailable')
        }
        throw err
      }

      // In order to perform the significant db updates ahead of
      // registering the did, we will use a temp invalid did. Once everything
      // goes well and a fresh did is registered, we'll replace the temp values.
      const tempDid = crypto.randomStr(16, 'base32')
      const now = new Date().toISOString()

      const result = await db.transaction(async (dbTxn) => {
        const actorTxn = services.actor(dbTxn)
        const repoTxn = services.repo(dbTxn)
        // Pre-register before going out to PLC to get a real did
        try {
          await actorTxn.preregisterDid(handle, tempDid)
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

        // Now that we have a real did, we create the declaration & replace the tempDid
        // and setup the repo root. This _should_ succeed under typical conditions.
        const declaration = {
          $type: lex.ids.AppBskySystemDeclaration,
          actorType: APP_BSKY_SYSTEM.ActorScene,
        }
        await actorTxn.finalizeDid(handle, did, tempDid, declaration)
        await dbTxn.db
          .insertInto('scene')
          .values({ handle, owner: requester, createdAt: now })
          .execute()

        const user = await dbTxn.db
          .selectFrom('did_handle')
          .where('did', '=', requester)
          .select('declarationCid')
          .executeTakeFirst()
        const userDeclarationCid = user?.declarationCid
        if (!userDeclarationCid) {
          throw new InvalidRequestError(
            `Could not locate user declaration for ${requester}`,
          )
        }
        const userAuth = locals.getAuthstore(res, requester)
        const sceneAuth = locals.getAuthstore(res, did)

        const sceneWrites = await Promise.all([
          repo.prepareCreate({
            did,
            collection: lex.ids.AppBskySystemDeclaration,
            record: declaration,
          }),
          repo.prepareCreate({
            did,
            collection: lex.ids.AppBskyGraphAssertion,
            record: {
              assertion: APP_BSKY_GRAPH.AssertCreator,
              subject: {
                did: requester,
                declarationCid: userDeclarationCid.toString(),
              },
              createdAt: now,
            },
          }),
          repo.prepareCreate({
            did,
            collection: lex.ids.AppBskyGraphAssertion,
            record: {
              assertion: APP_BSKY_GRAPH.AssertMember,
              subject: {
                did: requester,
                declarationCid: userDeclarationCid.toString(),
              },
              createdAt: now,
            },
          }),
        ])
        const [sceneDeclaration, creatorAssert, memberAssert] = sceneWrites

        const userWrites = await Promise.all([
          repo.prepareCreate({
            did: requester,
            collection: lex.ids.AppBskyGraphConfirmation,
            record: {
              originator: {
                did: requester,
                declarationCid: sceneDeclaration.cid.toString(),
              },
              assertion: {
                uri: creatorAssert.uri.toString(),
                cid: creatorAssert.cid.toString(),
              },
              createdAt: now,
            },
          }),
          repo.prepareCreate({
            did: requester,
            collection: lex.ids.AppBskyGraphConfirmation,
            record: {
              originator: {
                did: requester,
                declarationCid: sceneDeclaration.cid.toString(),
              },
              assertion: {
                uri: memberAssert.uri.toString(),
                cid: memberAssert.cid.toString(),
              },
              createdAt: now,
            },
          }),
        ])

        await Promise.all([
          repoTxn.createRepo(did, sceneAuth, sceneWrites, now),
          repoTxn.writeToRepo(requester, userAuth, userWrites, now),
          repoTxn.indexWrites([...sceneWrites, ...userWrites], now),
        ])

        return {
          did,
          declarationCid: sceneDeclaration.cid,
          actorType: declaration.actorType,
        }
      })

      return {
        encoding: 'application/json',
        body: {
          handle,
          did: result.did,
          declaration: {
            cid: result.declarationCid.toString(),
            actorType: result.actorType,
          },
        },
      }
    },
  })
}
