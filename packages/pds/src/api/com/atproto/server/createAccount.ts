import { InvalidRequestError } from '@atproto/xrpc-server'
import * as ident from '@atproto/identifier'
import * as plc from '@did-plc/lib'
import { Server } from '../../../../lexicon'
import { countAll } from '../../../../db/util'
import { UserAlreadyExistsError } from '../../../../services/account'
import AppContext from '../../../../context'
import { resolveExternalHandle } from '../identity/util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.createAccount(async ({ input, req }) => {
    const { email, password, inviteCode, recoveryKey } = input.body

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
        if (input.body.did === undefined) {
          throw new InvalidRequestError(err.message, 'UnsupportedDomain')
        }
        const resolvedHandleDid = await resolveExternalHandle(
          ctx.cfg.scheme,
          input.body.handle,
        )
        if (input.body.did !== resolvedHandleDid) {
          throw new InvalidRequestError(
            'External handle did not resolve to DID',
          )
        }
      }
      throw err
    }

    let did: string
    let plcCreateOp: plc.Operation | null = null
    if (input.body.did) {
      const didData = await ctx.didResolver.resolveAtpData(input.body.did)
      if (didData.signingKey !== ctx.repoSigningKey.did()) {
        throw new InvalidRequestError(
          `did document signingKey did not match service signingKey: ${ctx.repoSigningKey.did()}`,
          'InvalidDidDoc',
        )
      }
      if (didData.handle !== handle) {
        throw new InvalidRequestError(
          'did document handle did not match requested handle',
          'InvalidDidDoc',
        )
      }
      if (didData.pds !== ctx.cfg.publicUrl) {
        throw new InvalidRequestError(
          `did document AtprotoPersonalDataServer did not match service publicUrl: ${ctx.cfg.publicUrl}`,
          'InvalidDidDoc',
        )
      }

      // @TODO should we throw if the rotation key does not match?
      did = didData.did
    } else {
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
      did = plcCreate.did
      plcCreateOp = plcCreate.op
    }

    const now = new Date().toISOString()

    const result = await ctx.db.transaction(async (dbTxn) => {
      const actorTxn = ctx.services.account(dbTxn)
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

      // Register user before going out to PLC to get a real did
      try {
        await actorTxn.registerUser(email, handle, did, password)
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
      if (plcCreateOp !== null) {
        try {
          await ctx.plcClient.sendOperation(did, plcCreateOp)
        } catch (err) {
          req.log.error(
            { didKey: ctx.plcRotationKey.did(), handle },
            'failed to create did:plc',
          )
          throw err
        }
      }

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

      const access = ctx.auth.createAccessToken(did)
      const refresh = ctx.auth.createRefreshToken(did)
      await ctx.services.auth(dbTxn).grantRefreshToken(refresh.payload)

      return {
        accessJwt: access.jwt,
        refreshJwt: refresh.jwt,
      }
    })

    return {
      encoding: 'application/json',
      body: {
        handle,
        did,
        accessJwt: result.accessJwt,
        refreshJwt: result.refreshJwt,
      },
    }
  })
}
