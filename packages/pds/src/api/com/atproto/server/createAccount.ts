import { InvalidRequestError } from '@atproto/xrpc-server'
import * as ident from '@atproto/identifier'
import * as plc from '@did-plc/lib'
import * as scrypt from '../../../../db/scrypt'
import { Server } from '../../../../lexicon'
import { countAll } from '../../../../db/util'
import { UserAlreadyExistsError } from '../../../../services/account'
import AppContext from '../../../../context'
import Database from '../../../../db'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.createAccount(async ({ input, req }) => {
    const { email, password, inviteCode, recoveryKey } = input.body

    if (ctx.cfg.inviteRequired && !inviteCode) {
      throw new InvalidRequestError(
        'No invite code provided',
        'InvalidInviteCode',
      )
    }

    // validate handle
    let handle: string
    try {
      handle = ident.normalizeAndEnsureValidHandle(input.body.handle)
      ident.ensureHandleServiceConstraints(handle, ctx.cfg.availableUserDomains)
    } catch (err) {
      if (err instanceof ident.InvalidHandleError) {
        throw new InvalidRequestError(err.message, 'InvalidHandle')
      } else if (err instanceof ident.ReservedHandleError) {
        throw new InvalidRequestError(err.message, 'HandleNotAvailable')
      } else if (err instanceof ident.UnsupportedDomainError) {
        throw new InvalidRequestError(err.message, 'UnsupportedDomain')
      }
      throw err
    }

    // check that the invite code still has uses
    if (ctx.cfg.inviteRequired && inviteCode) {
      await ensureCodeIsAvailable(ctx.db, inviteCode)
    }

    const now = new Date().toISOString()

    const rotationKeys = [ctx.cfg.recoveryKey, ctx.plcRotationKey.did()]
    if (recoveryKey) {
      rotationKeys.unshift(recoveryKey)
    }
    // format create op, but don't send until we ensure the username & email are available
    const plcCreate = await plc.createOp({
      signingKey: ctx.repoSigningKey.did(),
      rotationKeys,
      handle,
      pds: ctx.cfg.publicUrl,
      signer: ctx.plcRotationKey,
    })
    const did = plcCreate.did

    const passwordScrypt = await scrypt.genSaltAndHash(password)

    const result = await ctx.db.transaction(async (dbTxn) => {
      const actorTxn = ctx.services.account(dbTxn)
      const repoTxn = ctx.services.repo(dbTxn)

      // it's a bit goofy that we run this logic twice,
      // but we run it once for a sanity check before doing scrypt & plc ops
      // & a second time for locking + integrity check
      if (ctx.cfg.inviteRequired && inviteCode) {
        await ensureCodeIsAvailable(dbTxn, inviteCode, true)
      }

      // Register user before going out to PLC to get a real did
      try {
        await actorTxn.registerUser({ email, handle, did, passwordScrypt })
      } catch (err) {
        if (err instanceof UserAlreadyExistsError) {
          const got = await actorTxn.getAccount(handle, true)
          if (got) {
            throw new InvalidRequestError(`Handle already taken: ${handle}`)
          } else {
            throw new InvalidRequestError(`Email already taken: ${email}`)
          }
        }
        throw err
      }

      // Generate a real did with PLC
      try {
        await ctx.plcClient.sendOperation(did, plcCreate.op)
      } catch (err) {
        req.log.error(
          { didKey: ctx.plcRotationKey.did(), handle },
          'failed to create did:plc',
        )
        throw err
      }

      // insert invite code use
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

      // Setup repo root
      await repoTxn.createRepo(did, [], now)

      const access = ctx.auth.createAccessToken({ did })
      const refresh = ctx.auth.createRefreshToken({ did })
      await ctx.services.auth(dbTxn).grantRefreshToken(refresh.payload, null)

      return {
        did,
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
      },
    }
  })
}

export const ensureCodeIsAvailable = async (
  db: Database,
  inviteCode: string,
  withLock = false,
): Promise<void> => {
  const invite = await db.db
    .selectFrom('invite_code')
    .selectAll()
    .where('code', '=', inviteCode)
    .if(withLock && db.dialect === 'pg', (qb) => qb.forUpdate().skipLocked())
    .executeTakeFirst()

  const uses = await db.db
    .selectFrom('invite_code_use')
    .select(countAll.as('count'))
    .where('code', '=', inviteCode)
    .executeTakeFirstOrThrow()

  if (!invite || invite.disabled || invite.availableUses <= uses.count) {
    throw new InvalidRequestError(
      'Provided invite code not available',
      'InvalidInviteCode',
    )
  }
}
