import { InvalidRequestError } from '@atproto/xrpc-server'
import { normalizeAndValidateHandle } from '../../../../handle'
import * as plc from '@did-plc/lib'
import * as scrypt from '../../../../db/scrypt'
import { Server } from '../../../../lexicon'
import { InputSchema as CreateAccountInput } from '../../../../lexicon/types/com/atproto/server/createAccount'
import { countAll } from '../../../../db/util'
import { UserAlreadyExistsError } from '../../../../services/account'
import AppContext from '../../../../context'
import Database from '../../../../db'
import { AtprotoData } from '@atproto/identity'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.createAccount(async ({ input, req }) => {
    const { email, password, inviteCode } = input.body

    if (ctx.cfg.inviteRequired && !inviteCode) {
      throw new InvalidRequestError(
        'No invite code provided',
        'InvalidInviteCode',
      )
    }

    // normalize & ensure valid handle
    const handle = await normalizeAndValidateHandle({
      ctx,
      handle: input.body.handle,
      did: input.body.did,
    })

    // check that the invite code still has uses
    if (ctx.cfg.inviteRequired && inviteCode) {
      await ensureCodeIsAvailable(ctx.db, inviteCode)
    }

    // determine the did & any plc ops we need to send
    // if the provided did document is poorly setup, we throw
    const { did, plcOp } = await getDidAndPlcOp(ctx, handle, input.body)

    const now = new Date().toISOString()
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
      if (plcOp) {
        try {
          await ctx.plcClient.sendOperation(did, plcOp)
        } catch (err) {
          req.log.error(
            { didKey: ctx.plcRotationKey.did(), handle },
            'failed to create did:plc',
          )
          throw err
        }
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

      const access = ctx.auth.createAccessToken({ did })
      const refresh = ctx.auth.createRefreshToken({ did })
      await ctx.services.auth(dbTxn).grantRefreshToken(refresh.payload, null)

      // Setup repo root
      await repoTxn.createRepo(did, [], now)

      return {
        did,
        accessJwt: access.jwt,
        refreshJwt: refresh.jwt,
      }
    })

    ctx.contentReporter?.checkHandle({ handle, did: result.did })

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
  const { ref } = db.db.dynamic
  const invite = await db.db
    .selectFrom('invite_code')
    .selectAll()
    .whereNotExists((qb) =>
      qb
        .selectFrom('repo_root')
        .selectAll()
        .where('takedownId', 'is not', null)
        .whereRef('did', '=', ref('invite_code.forUser')),
    )
    .where('code', '=', inviteCode)
    .if(withLock && db.dialect === 'pg', (qb) => qb.forUpdate().skipLocked())
    .executeTakeFirst()

  if (!invite || invite.disabled) {
    throw new InvalidRequestError(
      'Provided invite code not available',
      'InvalidInviteCode',
    )
  }

  const uses = await db.db
    .selectFrom('invite_code_use')
    .select(countAll.as('count'))
    .where('code', '=', inviteCode)
    .executeTakeFirstOrThrow()

  if (invite.availableUses <= uses.count) {
    throw new InvalidRequestError(
      'Provided invite code not available',
      'InvalidInviteCode',
    )
  }
}

const getDidAndPlcOp = async (
  ctx: AppContext,
  handle: string,
  input: CreateAccountInput,
): Promise<{
  did: string
  plcOp: plc.Operation | null
}> => {
  // if the user is not bringing a DID, then we format a create op for PLC
  // but we don't send until we ensure the username & email are available
  if (!input.did) {
    const rotationKeys = [ctx.cfg.recoveryKey, ctx.plcRotationKey.did()]
    if (input.recoveryKey) {
      rotationKeys.unshift(input.recoveryKey)
    }
    const plcCreate = await plc.createOp({
      signingKey: ctx.repoSigningKey.did(),
      rotationKeys,
      handle,
      pds: ctx.cfg.publicUrl,
      signer: ctx.plcRotationKey,
    })
    return {
      did: plcCreate.did,
      plcOp: plcCreate.op,
    }
  }

  // if the user is bringing their own did:
  // resolve the user's did doc data, including rotationKeys if did:plc
  // determine if we have the capability to make changes to their DID
  let atpData: AtprotoData
  try {
    atpData = await ctx.idResolver.did.resolveAtprotoData(input.did)
  } catch (err) {
    throw new InvalidRequestError(
      `could not resolve valid DID document :${input.did}`,
      'UnresolvableDid',
    )
  }
  if (atpData.handle !== handle) {
    throw new InvalidRequestError(
      'provided handle does not match DID document handle',
      'IncompatibleDidDoc',
    )
  } else if (atpData.pds !== ctx.cfg.publicUrl) {
    throw new InvalidRequestError(
      'DID document pds endpoint does not match service endpoint',
      'IncompatibleDidDoc',
    )
  } else if (atpData.signingKey !== ctx.repoSigningKey.did()) {
    throw new InvalidRequestError(
      'DID document signing key does not match service signing key',
      'IncompatibleDidDoc',
    )
  }

  if (input.did.startsWith('did:plc')) {
    const data = await ctx.plcClient.getDocumentData(input.did)
    if (!data.rotationKeys.includes(ctx.plcRotationKey.did())) {
      throw new InvalidRequestError(
        'PLC DID does not include service rotation key',
        'IncompatibleDidDoc',
      )
    }
  }

  return { did: input.did, plcOp: null }
}
