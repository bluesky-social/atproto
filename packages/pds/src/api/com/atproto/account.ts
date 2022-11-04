import { InvalidRequestError } from '@atproto/xrpc-server'
import { RepoStructure } from '@atproto/repo'
import { PlcClient } from '@atproto/plc'
import * as handleLib from '@atproto/handle'
import { Server } from '../../../lexicon'
import * as locals from '../../../locals'
import { countAll } from '../../../db/util'
import { UserAlreadyExistsError } from '../../../db'
import SqlBlockstore from '../../../sql-blockstore'
import { grantRefreshToken } from './util/auth'
import { AtUri } from '@atproto/uri'
import * as schema from '../../../lexicon/schemas'

export default function (server: Server) {
  server.com.atproto.server.getAccountsConfig((_params, _input, _req, res) => {
    const cfg = locals.config(res)

    const availableUserDomains = cfg.availableUserDomains
    const inviteCodeRequired = cfg.inviteRequired

    return {
      encoding: 'application/json',
      body: { availableUserDomains, inviteCodeRequired },
    }
  })

  server.com.atproto.account.get(() => {
    throw new InvalidRequestError('Not implemented')
  })

  server.com.atproto.account.create(async (_params, input, _req, res) => {
    const { password, inviteCode, recoveryKey } = input.body
    const { db, auth, config, keypair, logger } = locals.get(res)
    const handle = input.body.handle.toLowerCase()
    const email = input.body.email.toLowerCase()

    // throws if not
    try {
      handleLib.ensureValid(handle, config.availableUserDomains)
    } catch (err) {
      if (err instanceof handleLib.InvalidHandleError) {
        throw new InvalidRequestError(err.message, 'InvalidHandle')
      }
      throw err
    }

    const now = new Date().toISOString()

    const result = await db.transaction(async (dbTxn) => {
      if (config.inviteRequired) {
        if (!inviteCode) {
          throw new InvalidRequestError(
            'No invite code provided',
            'InvalidInviteCode',
          )
        }

        const invite = await dbTxn.db
          .selectFrom('invite_code')
          .selectAll()
          .where('code', '=', inviteCode)
          // Lock invite code to avoid duplicate use
          .if(dbTxn.dialect === 'pg', (qb) => qb.forUpdate())
          .executeTakeFirst()

        const { useCount } = await dbTxn.db
          .selectFrom('invite_code_use')
          .select(countAll.as('useCount'))
          .where('code', '=', inviteCode)
          .executeTakeFirstOrThrow()

        if (!invite || invite.disabled || invite.availableUses <= useCount) {
          logger.info({ handle, email, inviteCode }, 'invalid invite code')
          throw new InvalidRequestError(
            'Provided invite code not available',
            'InvalidInviteCode',
          )
        }
      }

      // Pre-register user before going out to PLC to get a real did

      try {
        await dbTxn.registerUser(email, handle, password)
      } catch (err) {
        if (err instanceof UserAlreadyExistsError) {
          if ((await dbTxn.getUser(handle)) !== null) {
            throw new InvalidRequestError(`Handle already taken: ${handle}`)
          } else if ((await dbTxn.getUserByEmail(email)) !== null) {
            throw new InvalidRequestError(`Email already taken: ${email}`)
          } else {
            throw new InvalidRequestError('Handle or email already taken')
          }
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

      // Now that we have a real did, we now replace the tempDid in user and invite_code_use
      // tables, and setup the repo root. These all _should_ succeed under typical conditions.
      // It's about as good as we're gonna get transactionally, given that we rely on PLC here to assign the did.

      await dbTxn.registerUserDid(handle, did)
      if (config.inviteRequired && inviteCode) {
        await dbTxn.db
          .insertInto('invite_code_use')
          .values({
            code: inviteCode,
            usedBy: did,
            usedAt: now,
          })
          .execute()
      }

      // Setup repo root
      const authStore = locals.getAuthstore(res, did)
      const blockstore = new SqlBlockstore(dbTxn, did, now)
      const repo = await RepoStructure.create(blockstore, did, authStore)

      const declaration = {
        $type: 'app.bsky.system.declaration',
        actorType: 'app.bsky.system.actorUser',
      }
      const declarationCid = await blockstore.put(declaration)
      const uri = new AtUri(
        `${did}/${schema.ids.AppBskySystemDeclaration}/self`,
      )

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

      await dbTxn.indexRecord(uri, declarationCid, declaration, now)

      const access = auth.createAccessToken(did)
      const refresh = auth.createRefreshToken(did)
      await grantRefreshToken(dbTxn, refresh.payload)

      return {
        did,
        declarationCid,
        accessJwt: access.jwt,
        refreshJwt: refresh.jwt,
      }
    })

    return {
      encoding: 'application/json',
      body: {
        handle,
        did: result.did,
        accessJwt: result.accessJwt,
        refreshJwt: result.refreshJwt,
        declarationCid: result.declarationCid.toString(),
      },
    }
  })

  server.com.atproto.account.delete(() => {
    // TODO
    throw new InvalidRequestError('Not implemented')
  })
}
