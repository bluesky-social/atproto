import assert from 'node:assert'
import { MINUTE, check } from '@atproto/common'
import { randomStr } from '@atproto/crypto'
import { AtprotoData, ensureAtpDocument } from '@atproto/identity'
import { XRPCError } from '@atproto/xrpc'
import { InvalidRequestError } from '@atproto/xrpc-server'
import * as plc from '@did-plc/lib'
import disposable from 'disposable-email'
import { normalizeAndValidateHandle } from '../../../../handle'
import * as scrypt from '../../../../db/scrypt'
import { Server } from '../../../../lexicon'
import { InputSchema as CreateAccountInput } from '../../../../lexicon/types/com/atproto/server/createAccount'
import { countAll } from '../../../../db/util'
import { UserAlreadyExistsError } from '../../../../services/account'
import AppContext from '../../../../context'
import Database from '../../../../db'
import { didDocForSession } from './util'
import { getPdsEndpoint } from '../../../../pds-agents'
import { isThisPds } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.createAccount({
    rateLimit: {
      durationMs: 5 * MINUTE,
      points: 100,
    },
    handler: async ({ input, req }) => {
      const hasAvailability = ctx.signupLimiter.hasAvailability()

      const {
        did,
        handle,
        email,
        password,
        inviteCode,
        plcOp,
        pds: entrywayAssignedPds,
      } = isInputForPdsViaEntryway(ctx, input.body)
        ? await validateInputsForPdsViaEntryway(ctx, input.body)
        : await validateInputsForPdsViaUser(ctx, input.body)

      const now = new Date().toISOString()
      const passwordScrypt = await scrypt.genSaltAndHash(password)

      let verificationPhone: string | undefined = undefined
      if (ctx.cfg.phoneVerification.required && ctx.twilio) {
        if (!input.body.verificationPhone) {
          throw new InvalidRequestError(
            'Phone number verification is required on this server and none was provided.',
            'InvalidPhoneVerification',
          )
        } else if (!input.body.verificationCode) {
          throw new InvalidRequestError(
            'Phone number verification is required on this server and none was provided.',
            'InvalidPhoneVerification',
          )
        }
        verificationPhone = ctx.twilio.normalizePhoneNumber(
          input.body.verificationPhone,
        )
        const verified = await ctx.twilio.verifyCode(
          verificationPhone,
          input.body.verificationCode.trim(),
        )
        if (!verified) {
          throw new InvalidRequestError(
            'Could not verify phone number. Please try again.',
            'InvalidPhoneVerification',
          )
        }
      }

      const result = await ctx.db.transaction(async (dbTxn) => {
        const actorTxn = ctx.services.account(dbTxn)
        const repoTxn = ctx.services.repo(dbTxn)

        // it's a bit goofy that we run this logic twice,
        // but we run it once for a sanity check before doing scrypt & plc ops
        // & a second time for locking + integrity check
        if (ctx.cfg.invites.required && inviteCode) {
          await ensureCodeIsAvailable(dbTxn, inviteCode, true)
        }

        // Register user before going out to PLC to get a real did
        try {
          await actorTxn.registerUser({
            email,
            handle,
            did,
            pdsId: entrywayAssignedPds?.id,
            passwordScrypt,
            activated: hasAvailability,
          })
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
        if (plcOp && !entrywayAssignedPds) {
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
        if (ctx.cfg.invites.required && inviteCode) {
          await dbTxn.db
            .insertInto('invite_code_use')
            .values({
              code: inviteCode,
              usedBy: did,
              usedAt: now,
            })
            .execute()
        }

        if (ctx.cfg.phoneVerification.required && verificationPhone) {
          await dbTxn.db
            .insertInto('phone_verification')
            .values({
              did,
              phoneNumber: verificationPhone,
            })
            .execute()
        }

        const { access, refresh } = await ctx.services
          .auth(dbTxn)
          .createSession({
            did,
            pdsDid: entrywayAssignedPds?.did ?? null,
            appPasswordName: null,
            deactivated: !hasAvailability,
          })

        if (entrywayAssignedPds) {
          const agent = ctx.pdsAgents.get(entrywayAssignedPds.host)
          await agent.com.atproto.server.createAccount({
            did,
            plcOp: plcOp ?? undefined,
            handle: input.body.handle,
            recoveryKey: input.body.recoveryKey,
          })
        } else {
          // Setup repo root
          await repoTxn.createRepo(did, [], now)
        }

        return {
          did,
          pdsDid: entrywayAssignedPds?.did ?? null,
          accessJwt: access,
          refreshJwt: refresh,
        }
      })

      const didDoc = await didDocForSession(ctx, result)

      return {
        encoding: 'application/json',
        body: {
          handle,
          did: result.did,
          didDoc,
          accessJwt: result.accessJwt,
          refreshJwt: result.refreshJwt,
        },
      }
    },
  })
}

const isInputForPdsViaEntryway = (
  ctx: AppContext,
  input: CreateAccountInput,
) => {
  // detects case where pds is being contacted by an entryway.
  // this case is just for testing purposes.
  return (
    !ctx.cfg.service.isEntryway &&
    input.did &&
    input.plcOp &&
    !input.email &&
    !input.password
  )
}

const validateInputsForPdsViaEntryway = async (
  ctx: AppContext,
  input: CreateAccountInput,
) => {
  // @NOTE non-entryway codepath, just for testing purposes.
  assert(!ctx.cfg.service.isEntryway)
  const { did, handle, plcOp } = input
  if (!did || !input.plcOp) {
    throw new InvalidRequestError(
      'non-entryway pds requires bringing a DID and plcOp',
    )
  }
  if (!check.is(plcOp, plc.def.operation)) {
    throw new InvalidRequestError('invalid plc operation', 'IncompatibleDidDoc')
  }

  await plc.assureValidOp(plcOp)
  const doc = plc.formatDidDoc({ did, ...plcOp })
  const data = ensureAtpDocument(doc)

  // @NOTE a real pds behaind an entryway would typically check that the doc includes entryway's rotation key
  validateAtprotoData(data, {
    handle,
    pds: ctx.cfg.service.publicUrl,
    signingKey: ctx.repoSigningKey.did(),
  })

  return {
    did,
    handle,
    // @NOTE a real pds behaind an entryway would not keep an email or password
    email: `${did}@email.invalid`,
    password: randomStr(16, 'hex'),
    inviteCode: undefined,
    plcOp,
    pds: undefined,
  }
}

const validateInputsForPdsViaUser = async (
  ctx: AppContext,
  input: CreateAccountInput,
) => {
  const { email, password, inviteCode } = input
  if (input.plcOp) {
    throw new InvalidRequestError('Unsupported input: "plcOp"')
  }

  if (ctx.cfg.invites.required && !inviteCode) {
    throw new InvalidRequestError(
      'No invite code provided',
      'InvalidInviteCode',
    )
  }

  if (!email) {
    throw new InvalidRequestError('Email is required')
  } else if (!disposable.validate(email)) {
    throw new InvalidRequestError(
      'This email address is not supported, please use a different email.',
    )
  }

  if (!password) {
    throw new InvalidRequestError('Password is required')
  }

  // normalize & ensure valid handle
  const handle = await normalizeAndValidateHandle({
    ctx,
    handle: input.handle,
    did: input.did,
  })

  // check that the invite code still has uses
  if (ctx.cfg.invites.required && inviteCode) {
    await ensureCodeIsAvailable(ctx.db, inviteCode)
  }

  // determine the did & any plc ops we need to send
  // if the provided did document is poorly setup, we throw
  const pds = await assignPds(ctx)
  const pdsEndpoint = pds ? getPdsEndpoint(pds.host) : ctx.cfg.service.publicUrl
  const pdsSigningKey = pds
    ? await reserveSigningKey(ctx, pds.host)
    : ctx.repoSigningKey.did()

  const { did, plcOp } = input.did
    ? await validateExistingDid(
        ctx,
        handle,
        input.did,
        pdsEndpoint,
        pdsSigningKey,
      )
    : await createDidAndPlcOp(ctx, handle, input, pdsEndpoint, pdsSigningKey)

  return {
    did,
    handle,
    email,
    password,
    inviteCode,
    plcOp,
    pds,
  }
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
        .selectFrom('user_account')
        .selectAll()
        .where('takedownRef', 'is not', null)
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

const createDidAndPlcOp = async (
  ctx: AppContext,
  handle: string,
  input: CreateAccountInput,
  pdsEndpoint: string,
  signingDidKey: string,
): Promise<{
  did: string
  plcOp: plc.Operation | null
}> => {
  // if the user is not bringing a DID, then we format a create op for PLC
  const rotationKeys = [ctx.plcRotationKey.did()]
  if (ctx.cfg.identity.recoveryDidKey) {
    rotationKeys.unshift(ctx.cfg.identity.recoveryDidKey)
  }
  if (input.recoveryKey) {
    rotationKeys.unshift(input.recoveryKey)
  }
  const plcCreate = await plc.createOp({
    signingKey: signingDidKey,
    rotationKeys,
    handle,
    pds: pdsEndpoint,
    signer: ctx.plcRotationKey,
  })
  return {
    did: plcCreate.did,
    plcOp: plcCreate.op,
  }
}

const validateExistingDid = async (
  ctx: AppContext,
  handle: string,
  did: string,
  pdsEndpoint: string,
  signingDidKey: string,
): Promise<{
  did: string
  plcOp: plc.Operation | null
}> => {
  // if the user is bringing their own did:
  // resolve the user's did doc data, including rotationKeys if did:plc
  // determine if we have the capability to make changes to their DID
  let atpData: AtprotoData
  try {
    atpData = await ctx.idResolver.did.resolveAtprotoData(did)
  } catch (err) {
    throw new InvalidRequestError(
      `could not resolve valid DID document: ${did}`,
      'UnresolvableDid',
    )
  }
  validateAtprotoData(atpData, {
    handle,
    pds: pdsEndpoint,
    signingKey: signingDidKey,
  })

  if (did.startsWith('did:plc') && ctx.cfg.service.isEntryway) {
    const data = await ctx.plcClient.getDocumentData(did)
    if (!data.rotationKeys.includes(ctx.plcRotationKey.did())) {
      throw new InvalidRequestError(
        'PLC DID does not include service rotation key',
        'IncompatibleDidDoc',
      )
    }
  }

  return { did, plcOp: null }
}

const validateAtprotoData = (
  data: AtprotoData,
  expected: {
    handle: string
    pds: string
    signingKey: string
  },
) => {
  // if the user is bringing their own did:
  // resolve the user's did doc data, including rotationKeys if did:plc
  // determine if we have the capability to make changes to their DID
  if (data.handle !== expected.handle) {
    throw new InvalidRequestError(
      'provided handle does not match DID document handle',
      'IncompatibleDidDoc',
    )
  } else if (data.pds !== expected.pds) {
    throw new InvalidRequestError(
      'DID document pds endpoint does not match service endpoint',
      'IncompatibleDidDoc',
    )
  } else if (data.signingKey !== expected.signingKey) {
    throw new InvalidRequestError(
      'DID document signing key does not match service signing key',
      'IncompatibleDidDoc',
    )
  }
}

// @TODO this implementation is a stub
const assignPds = async (ctx: AppContext) => {
  if (!ctx.cfg.service.isEntryway) return
  const accountService = ctx.services.account(ctx.db)
  const pdses = await accountService.getPdses()
  const idx = randomIndexByWeight(pdses.map((pds) => pds.weight))
  if (idx === -1) return
  const pds = pdses.at(idx)
  if (isThisPds(ctx, pds?.did)) return
  return pds
}

const reserveSigningKey = async (ctx: AppContext, host: string) => {
  try {
    const agent = ctx.pdsAgents.get(host)
    const result = await agent.com.atproto.server.reserveSigningKey({})
    return result.data.signingKey
  } catch (err) {
    if (err instanceof XRPCError) {
      throw new InvalidRequestError('failed to reserve signing key')
    }
    throw err
  }
}

const randomIndexByWeight = (weights) => {
  let sum = 0
  const cumulative = weights.map((weight) => {
    sum += weight
    return sum
  })
  if (!sum) return -1
  const rand = Math.random() * sum
  return cumulative.findIndex((item) => item >= rand)
}
