import { InvalidRequestError } from '@atproto/xrpc-server'
import * as crypto from '@atproto/crypto'
import * as handleLib from '@atproto/handle'
import { cidForCbor } from '@atproto/common'
import { Server, APP_BSKY_SYSTEM } from '../../../lexicon'
import { countAll } from '../../../db/util'
import * as lex from '../../../lexicon/lexicons'
import * as repo from '../../../repo'
import { UserAlreadyExistsError } from '../../../services/actor'
import AppContext from '../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.getAccountsConfig(() => {
    const availableUserDomains = ctx.cfg.availableUserDomains
    const inviteCodeRequired = ctx.cfg.inviteRequired
    const privacyPolicy = ctx.cfg.privacyPolicyUrl
    const termsOfService = ctx.cfg.termsOfServiceUrl

    return {
      encoding: 'application/json',
      body: {
        availableUserDomains,
        inviteCodeRequired,
        links: { privacyPolicy, termsOfService },
      },
    }
  })

  server.com.atproto.account.get(() => {
    throw new InvalidRequestError('Not implemented')
  })

  server.com.atproto.account.create(async ({ input, req }) => {
    const { email, password, inviteCode, recoveryKey } = input.body

    let handle: string
    try {
      handle = handleLib.normalizeAndEnsureValid(
        input.body.handle,
        ctx.cfg.availableUserDomains,
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

    const result = await ctx.db.transaction(async (dbTxn) => {
      const actorTxn = ctx.services.actor(dbTxn)
      const repoTxn = ctx.services.repo(dbTxn)
      if (ctx.cfg.inviteRequired) {
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
          req.log.info({ handle, email, inviteCode }, 'invalid invite code')
          throw new InvalidRequestError(
            'Provided invite code not available',
            'InvalidInviteCode',
          )
        }
      }

      // Pre-register user before going out to PLC to get a real did
      try {
        await actorTxn.preregisterDid(handle, tempDid)
      } catch (err) {
        if (err instanceof UserAlreadyExistsError) {
          throw new InvalidRequestError(`Handle already taken: ${handle}`)
        }
        throw err
      }
      try {
        await actorTxn.registerUser(email, handle, password)
      } catch (err) {
        if (err instanceof UserAlreadyExistsError) {
          throw new InvalidRequestError(`Email already taken: ${email}`)
        }
        throw err
      }

      // Generate a real did with PLC
      let did: string
      try {
        did = await ctx.plcClient.createDid(
          ctx.keypair,
          recoveryKey || ctx.cfg.recoveryKey,
          handle,
          ctx.cfg.publicUrl,
        )
      } catch (err) {
        req.log.error(
          { didKey: ctx.keypair.did(), handle },
          'failed to create did:plc',
        )
        throw err
      }

      // Now that we have a real did, we create the declaration & replace the tempDid
      // and setup the repo root. This _should_ succeed under typical conditions.
      const declaration = {
        $type: lex.ids.AppBskySystemDeclaration,
        actorType: APP_BSKY_SYSTEM.ActorUser,
      }
      await actorTxn.finalizeDid(handle, did, tempDid, declaration)
      if (ctx.cfg.inviteRequired && inviteCode) {
        await dbTxn.db
          .insertInto('invite_code_use')
          .values({
            code: inviteCode,
            usedBy: did,
            usedAt: now,
          })
          .execute()
      }

      const write = await repo.prepareCreate({
        did,
        collection: lex.ids.AppBskySystemDeclaration,
        record: declaration,
      })

      // Setup repo root
      await repoTxn.createRepo(did, [write], now)
      await repoTxn.indexWrites([write], now)

      const declarationCid = await cidForCbor(declaration)
      const access = ctx.auth.createAccessToken(did)
      const refresh = ctx.auth.createRefreshToken(did)
      await ctx.services.auth(dbTxn).grantRefreshToken(refresh.payload)

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
