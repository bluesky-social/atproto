import { MINUTE, cborDecode, cborEncode, check } from '@atproto/common'
import { AtprotoData, ensureAtpDocument } from '@atproto/identity'
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
import { isThisPds } from '../../../proxy'
import { didDocForSession } from './util'
import { getPdsEndpoint } from '../../../../pds-agents'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.createAccount({
    rateLimit: {
      durationMs: 5 * MINUTE,
      points: 100,
    },
    handler: async ({ input, req }) => {
      const { email, password, inviteCode } = input.body

      if (!ctx.cfg.service.isEntryway && !input.body.did && !input.body.plcOp) {
        throw new InvalidRequestError(
          'non-entryway pds requires bringing a DID or PLC operation',
        )
      }

      if (ctx.cfg.invites.required && !inviteCode) {
        throw new InvalidRequestError(
          'No invite code provided',
          'InvalidInviteCode',
        )
      }

      if (!disposable.validate(email)) {
        throw new InvalidRequestError(
          'This email address is not supported, please use a different email.',
        )
      }

      // normalize & ensure valid handle
      const handle = await normalizeAndValidateHandle({
        ctx,
        handle: input.body.handle,
        did: input.body.did,
      })

      // check that the invite code still has uses
      if (ctx.cfg.invites.required && inviteCode) {
        await ensureCodeIsAvailable(ctx.db, inviteCode)
      }

      // determine the did & any plc ops we need to send
      // if the provided did document is poorly setup, we throw
      const pds = await assignPds(ctx)
      const { did, plcOp } = await getDidAndPlcOp(ctx, pds, handle, input.body)

      const now = new Date().toISOString()
      const passwordScrypt = await scrypt.genSaltAndHash(password)

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
            pdsId: pds?.id,
            passwordScrypt,
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
        if (plcOp && isThisPds(ctx, pds?.did)) {
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

        const { access, refresh } = await ctx.services
          .auth(dbTxn)
          .createSession({
            did,
            pdsDid: pds?.did ?? null,
            appPasswordName: null,
          })

        if (!pds || isThisPds(ctx, pds.did)) {
          // Setup repo root
          await repoTxn.createRepo(did, [], now)
        } else {
          const agent = ctx.pdsAgents.get(pds.host)
          await agent.com.atproto.server.createAccount({
            ...input.body,
            did,
            plcOp: plcOp ? cborEncode(plcOp) : undefined,
          })
        }

        return {
          did,
          accessJwt: access,
          refreshJwt: refresh,
        }
      })

      const didDoc = await didDocForSession(ctx, result.did, true)

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

const getDidAndPlcOp = async (
  ctx: AppContext,
  pds: { host: string } | undefined,
  handle: string,
  input: CreateAccountInput,
): Promise<{
  did: string
  plcOp: plc.Operation | null
}> => {
  const pdsEndpoint = pds ? getPdsEndpoint(pds.host) : ctx.cfg.service.publicUrl
  const pdsSigningKey = pds
    ? await reserveSigningKey(ctx, pds.host)
    : ctx.repoSigningKey.did()

  // if the user brings their own PLC op then we validate it then submit it to PLC on their behalf
  if (input.plcOp) {
    let atpData: AtprotoData
    let plcOp: plc.Operation
    try {
      plcOp = check.assure(plc.def.operation, cborDecode(input.plcOp))
      const did = await plc.didForCreateOp(plcOp)
      const docData = await plc.assureValidCreationOp(did, plcOp)
      const doc = plc.formatDidDoc(docData)
      atpData = ensureAtpDocument(doc)
    } catch (err) {
      throw new InvalidRequestError(
        'could not validate PLC creation operation',
        'InvalidPlcOp',
      )
    }
    if (input.did && input.did !== atpData.did) {
      throw new InvalidRequestError(
        'the DID does not match the PLC creation operation',
        'IncompatiblePlcOp',
      )
    }
    if (atpData.handle !== handle) {
      throw new InvalidRequestError(
        'provided handle does not match PLC operation handle',
        'IncompatiblePlcOp',
      )
    } else if (atpData.pds !== pdsEndpoint) {
      throw new InvalidRequestError(
        'PLC operation pds endpoint does not match service endpoint',
        'IncompatiblePlcOp',
      )
    } else if (atpData.signingKey !== pdsSigningKey) {
      throw new InvalidRequestError(
        'PLC operation signing key does not match service signing key',
        'IncompatiblePlcOp',
      )
    }
    return { did: atpData.did, plcOp }
  }

  // if the user is not bringing a DID, then we format a create op for PLC
  // but we don't send until we ensure the username & email are available
  if (!input.did) {
    const rotationKeys = [ctx.plcRotationKey.did()]
    if (ctx.cfg.identity.recoveryDidKey) {
      rotationKeys.unshift(ctx.cfg.identity.recoveryDidKey)
    }
    if (input.recoveryKey) {
      rotationKeys.unshift(input.recoveryKey)
    }
    const plcCreate = await plc.createOp({
      signingKey: pdsSigningKey,
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

  // if the user is bringing their own did:
  // resolve the user's did doc data, including rotationKeys if did:plc
  // determine if we have the capability to make changes to their DID
  let atpData: AtprotoData
  try {
    atpData = await ctx.idResolver.did.resolveAtprotoData(input.did)
  } catch (err) {
    throw new InvalidRequestError(
      `could not resolve valid DID document: ${input.did}`,
      'UnresolvableDid',
    )
  }
  if (atpData.handle !== handle) {
    throw new InvalidRequestError(
      'provided handle does not match DID document handle',
      'IncompatibleDidDoc',
    )
  } else if (atpData.pds !== pdsEndpoint) {
    throw new InvalidRequestError(
      'DID document pds endpoint does not match service endpoint',
      'IncompatibleDidDoc',
    )
  } else if (atpData.signingKey !== pdsSigningKey) {
    throw new InvalidRequestError(
      'DID document signing key does not match service signing key',
      'IncompatibleDidDoc',
    )
  }

  // non-entryway pds doesn't require matching plc rotation key, will be handled by its entryway
  if (input.did.startsWith('did:plc') && ctx.cfg.service.isEntryway) {
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

// @TODO this implementation is a stub
const assignPds = async (ctx: AppContext) => {
  if (!ctx.cfg.service.isEntryway) return
  const pdses = await ctx.db.db.selectFrom('pds').selectAll().execute()
  const idx = randomIndexByWeight(pdses.map((pds) => pds.weight))
  if (idx === -1) return
  return pdses.at(idx)
}

const reserveSigningKey = async (ctx: AppContext, host: string) => {
  const agent = ctx.pdsAgents.get(host)
  const result = await agent.com.atproto.server.reserveSigningKey()
  return result.data.signingKey
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
