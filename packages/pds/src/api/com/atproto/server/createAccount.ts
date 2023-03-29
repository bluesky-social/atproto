import { InvalidRequestError } from '@atproto/xrpc-server'
import * as ident from '@atproto/identifier'
import * as plc from '@did-plc/lib'
import { Server } from '../../../../lexicon'
import { InputSchema } from '@atproto/api/src/client/types/com/atproto/server/createAccount'
import { countAll } from '../../../../db/util'
import { UserAlreadyExistsError } from '../../../../services/account'
import AppContext from '../../../../context'
import { resolveExternalHandle } from '../identity/util'
import { AtprotoData } from '@atproto/did-resolver'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.createAccount(async ({ input, req }) => {
    const { email, password, inviteCode } = input.body

    // normalize & ensure valid handle
    const handle = await ensureValidHandle(ctx, input.body)
    // determine the did & any plc ops we need to send
    // if the did document is poorly setup & we aren't able to update it, we throw
    const { did, plcOp } = await getDidAndPlcOp(ctx, handle, input.body)

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
      if (plcOp !== null) {
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

const ensureValidHandle = async (
  ctx: AppContext,
  input: InputSchema,
): Promise<string> => {
  try {
    const handle = ident.normalizeAndEnsureValidHandle(input.handle)
    ident.ensureHandleServiceConstraints(handle, ctx.cfg.availableUserDomains)
    return handle
  } catch (err) {
    if (err instanceof ident.InvalidHandleError) {
      throw new InvalidRequestError(err.message, 'InvalidHandle')
    } else if (err instanceof ident.ReservedHandleError) {
      throw new InvalidRequestError(err.message, 'HandleNotAvailable')
    } else if (err instanceof ident.UnsupportedDomainError) {
      if (input.did === undefined) {
        throw new InvalidRequestError(err.message, 'UnsupportedDomain')
      }
      const resolvedHandleDid = await resolveExternalHandle(
        ctx.cfg.scheme,
        input.handle,
      )
      if (input.did !== resolvedHandleDid) {
        throw new InvalidRequestError('External handle did not resolve to DID')
      }
    }
    throw err
  }
}

const getDidAndPlcOp = async (
  ctx: AppContext,
  handle: string,
  input: InputSchema,
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

  // resolve the user's did doc data, including rotationKeys if did:plc
  // determine if we have the capability to make changes to their DID
  const atpData = await ctx.didResolver.resolveAtpData(input.did)
  const didData = {
    ...atpData,
    rotationKeys: null as string[] | null,
  }
  let canChange: boolean
  if (!input.did.startsWith('did:plc:')) {
    canChange = false
  } else {
    const data = await ctx.plcClient.getDocumentData(input.did)
    didData.rotationKeys = data.rotationKeys
    canChange = data.rotationKeys.includes(ctx.plcRotationKey.did())
  }

  // check what, if any, updates are needed for the did document
  const updates = determineDidDocUpdates(
    ctx,
    didData,
    handle,
    input.recoveryKey,
  )

  // if updates are needed & we can't perform them, then throw
  if (!canChange && Object.keys(updates).length > 0) {
    let err: string | undefined
    if (updates.signingKey) {
      err = `did document signingKey did not match service signingKey: ${ctx.repoSigningKey.did()}`
    } else if (updates.handle) {
      err = `did document handle did not match requested handle: ${handle}`
    } else if (updates.pds) {
      err = `did document AtprotoPersonalDataServer did not match service publicUrl: ${ctx.cfg.publicUrl}`
    }
    if (err) {
      throw new InvalidRequestError(err, 'InvalidDidDoc')
    }
  }

  // if updates are needed & we can perform them, then format the needed op

  let plcOp: plc.Operation | null = null
  if (Object.keys(updates).length > 0) {
    const last = await ctx.plcClient.ensureLastOp(input.did)
    plcOp = await plc.createAtprotoUpdateOp(last, ctx.plcRotationKey, updates)
  }

  return {
    did: input.did,
    plcOp,
  }
}

type DidDocUpdates = Partial<{
  signingKey: string
  handle: string
  pds: string
  rotationKeys: string[]
}>

const determineDidDocUpdates = (
  ctx: AppContext,
  didData: AtprotoData & { rotationKeys: string[] | null },
  handle: string,
  userRecoveryKey?: string,
): DidDocUpdates => {
  const updates: DidDocUpdates = {}
  if (didData.signingKey !== ctx.repoSigningKey.did()) {
    updates.signingKey = ctx.repoSigningKey.did()
  }
  if (didData.handle !== handle) {
    updates.handle = handle
  }
  if (didData.pds !== ctx.cfg.publicUrl) {
    updates.pds = ctx.cfg.publicUrl
  }
  if (
    didData.rotationKeys !== null &&
    didData.rotationKeys.includes(ctx.repoSigningKey.did())
  ) {
    let rotationKeys: string[] = [...didData.rotationKeys]
    if (!rotationKeys.includes(ctx.cfg.recoveryKey)) {
      const index = rotationKeys.indexOf(ctx.repoSigningKey.did())
      rotationKeys = [
        ...rotationKeys.slice(0, index),
        ctx.cfg.recoveryKey,
        ...rotationKeys.slice(index),
      ]
      updates.rotationKeys = rotationKeys
    }
    if (userRecoveryKey && !didData.rotationKeys.includes(userRecoveryKey)) {
      rotationKeys = [userRecoveryKey, ...rotationKeys]
      updates.rotationKeys = rotationKeys
    }
  }
  return updates
}
