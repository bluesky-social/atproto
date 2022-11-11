import { Server, APP_BSKY_SYSTEM, APP_BSKY_GRAPH } from '../../../../lexicon'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { PlcClient } from '@atproto/plc'
import * as crypto from '@atproto/crypto'
import * as handleLib from '@atproto/handle'
import * as locals from '../../../../locals'
import * as schema from '../../../../lexicon/schemas'
import { RepoStructure } from '@atproto/repo'
import { TID } from '@atproto/common'
import { UserAlreadyExistsError } from '../../../../db'
import * as repoUtil from '../../../../util/repo'

export default function (server: Server) {
  server.app.bsky.actor.createScene(async (_params, input, req, res) => {
    const { db, auth, config, keypair, logger } = locals.get(res)
    const { recoveryKey } = input.body

    const requester = auth.getUserDid(req)
    if (!requester) {
      throw new AuthRequiredError()
    }

    let handle: string
    try {
      handle = handleLib.normalizeAndEnsureValid(
        input.body.handle,
        config.availableUserDomains,
      )
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

      // Now that we have a real did, we create the declaration & replace the tempDid
      // and setup the repo root. This _should_ succeed under typical conditions.
      const declaration = {
        $type: schema.ids.AppBskySystemDeclaration,
        actorType: APP_BSKY_SYSTEM.ActorScene,
      }
      await dbTxn.finalizeDid(handle, did, tempDid, declaration)
      await dbTxn.db
        .insertInto('scene')
        .values({ handle, owner: requester, createdAt: now })
        .execute()

      const userRoot = await dbTxn.getRepoRoot(requester, true)
      if (!userRoot) {
        throw new InvalidRequestError(
          `${requester} is not a registered repo on this server`,
        )
      }
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
      const userCtx = repoUtil.mutationContext(dbTxn, did, now)
      const userRepo = await RepoStructure.load(userCtx.blockstore, userRoot)

      const sceneAuth = locals.getAuthstore(res, did)
      const sceneCtx = repoUtil.mutationContext(dbTxn, did, now)
      const sceneRepo = await RepoStructure.create(
        sceneCtx.blockstore,
        did,
        sceneAuth,
      )

      const [sceneDeclaration, creatorAssert, memberAssert] = await Promise.all(
        [
          repoUtil.prepareCreate(
            sceneCtx,
            schema.ids.AppBskySystemDeclaration,
            'self',
            declaration,
          ),
          repoUtil.prepareCreate(
            sceneCtx,
            schema.ids.AppBskyGraphAssertion,
            TID.nextStr(),
            {
              assertion: APP_BSKY_GRAPH.AssertCreator,
              subject: {
                did: requester,
                declarationCid: userDeclarationCid.toString(),
              },
              createdAt: new Date().toISOString(),
            },
          ),
          repoUtil.prepareCreate(
            sceneCtx,
            schema.ids.AppBskyGraphAssertion,
            TID.nextStr(),
            {
              assertion: APP_BSKY_GRAPH.AssertMember,
              subject: {
                did: requester,
                declarationCid: userDeclarationCid.toString(),
              },
              createdAt: new Date().toISOString(),
            },
          ),
        ],
      )

      const [creatorConfirm, memberConfirm] = await Promise.all([
        repoUtil.prepareCreate(
          sceneCtx,
          schema.ids.AppBskyGraphConfirmation,
          TID.nextStr(),
          {
            originator: {
              did: requester,
              declarationCid: sceneDeclaration.cid.toString(),
            },
            assertion: {
              uri: creatorAssert.uri.toString(),
              cid: creatorAssert.cid.toString(),
            },
            createdAt: new Date().toISOString(),
          },
        ),
        repoUtil.prepareCreate(
          sceneCtx,
          schema.ids.AppBskyGraphConfirmation,
          TID.nextStr(),
          {
            originator: {
              did: requester,
              declarationCid: sceneDeclaration.cid.toString(),
            },
            assertion: {
              uri: memberAssert.uri.toString(),
              cid: memberAssert.cid.toString(),
            },
            createdAt: new Date().toISOString(),
          },
        ),
      ])

      const sceneCommit = sceneRepo
        .stageUpdate([
          sceneDeclaration.toStage,
          creatorAssert.toStage,
          memberAssert.toStage,
        ])
        .createCommit(sceneAuth, async (_prev, curr) => {
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

      const userCommit = userRepo
        .stageUpdate([creatorConfirm.toStage, memberConfirm.toStage])
        .createCommit(userAuth, async (prev, curr) => {
          const success = await dbTxn.updateRepoRoot(requester, curr, prev, now)
          if (!success) {
            logger.error({ did, curr, prev }, 'repo update failed')
            throw new Error('Could not update repo root')
          }
          return null
        })

      await Promise.all([
        sceneCommit,
        userCommit,
        sceneDeclaration.dbUpdate,
        creatorAssert.dbUpdate,
        memberAssert.dbUpdate,
        creatorConfirm.dbUpdate,
        memberConfirm.dbUpdate,
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
  })
}
