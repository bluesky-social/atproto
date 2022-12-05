import { InvalidRequestError } from '@atproto/xrpc-server'
import { PlcClient } from '@atproto/plc'
import * as crypto from '@atproto/crypto'
import * as handleLib from '@atproto/handle'
import { Server, APP_BSKY_SYSTEM } from '../../../lexicon'
import * as locals from '../../../locals'
import { countAll } from '../../../db/util'
import { UserAlreadyExistsError } from '../../../db'
import { grantRefreshToken } from './util/auth'
import * as lexicons from '../../../lexicon/lexicons'
import * as repoUtil from '../../../util/repo'
import { cidForData } from '@atproto/common'

export default function (server: Server) {
  server.com.atproto.server.getAccountsConfig(({ res }) => {
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

  server.com.atproto.account.create(async ({ input, res }) => {
    const { email, password, inviteCode, recoveryKey } = input.body
    const { db, auth, config, keypair, logger } = locals.get(res)

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
        await dbTxn.preregisterDid(handle, tempDid)
      } catch (err) {
        if (err instanceof UserAlreadyExistsError) {
          throw new InvalidRequestError(`Handle already taken: ${handle}`)
        }
        throw err
      }
      try {
        await dbTxn.registerUser(email, handle, password)
      } catch (err) {
        if (err instanceof UserAlreadyExistsError) {
          throw new InvalidRequestError(`Email already taken: ${email}`)
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
        $type: lexicons.ids.AppBskySystemDeclaration,
        actorType: APP_BSKY_SYSTEM.ActorUser,
      }
      await dbTxn.finalizeDid(handle, did, tempDid, declaration)
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

      const write = await repoUtil.prepareCreate(did, {
        action: 'create',
        collection: lexicons.ids.AppBskySystemDeclaration,
        rkey: 'self',
        value: declaration,
      })

      // Setup repo root
      const authStore = locals.getAuthstore(res, did)
      await repoUtil.createRepo(dbTxn, did, authStore, [write], now)
      await repoUtil.indexWrites(dbTxn, [write], now)

      const declarationCid = await cidForData(declaration)
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
