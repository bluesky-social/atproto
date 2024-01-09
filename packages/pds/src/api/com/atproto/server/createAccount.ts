import { DidDocument, MINUTE, check } from '@atproto/common'
import { AtprotoData, ensureAtpDocument } from '@atproto/identity'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { ExportableKeypair, Keypair, Secp256k1Keypair } from '@atproto/crypto'
import * as plc from '@did-plc/lib'
import disposable from 'disposable-email'
import {
  baseNormalizeAndValidate,
  normalizeAndValidateHandle,
} from '../../../../handle'
import { Server } from '../../../../lexicon'
import { InputSchema as CreateAccountInput } from '../../../../lexicon/types/com/atproto/server/createAccount'
import AppContext from '../../../../context'
import { didDocForSession } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.createAccount({
    rateLimit: {
      durationMs: 5 * MINUTE,
      points: 100,
    },
    handler: async ({ input, req }) => {
      const { did, handle, email, password, inviteCode, signingKey, plcOp } =
        ctx.entrywayAgent
          ? await validateInputsForEntrywayPds(ctx, input.body)
          : await validateInputsForLocalPds(ctx, input.body)

      let didDoc: DidDocument | undefined
      let creds: { accessJwt: string; refreshJwt: string }
      await ctx.actorStore.create(did, signingKey)
      try {
        const commit = await ctx.actorStore.transact(did, (actorTxn) =>
          actorTxn.repo.createRepo([]),
        )

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

        creds = await ctx.accountManager.createAccount({
          did,
          handle,
          email,
          password,
          repoCid: commit.cid,
          repoRev: commit.rev,
          inviteCode,
        })

        await ctx.sequencer.sequenceCommit(did, commit, [])
        await ctx.accountManager.updateRepoRoot(did, commit.cid, commit.rev)
        didDoc = await didDocForSession(ctx, did, true)
        await ctx.actorStore.clearReservedKeypair(signingKey.did(), did)
      } catch (err) {
        // this will only be reached if the actor store _did not_ exist before
        await ctx.actorStore.destroy(did)
        throw err
      }

      return {
        encoding: 'application/json',
        body: {
          handle,
          did: did,
          didDoc,
          accessJwt: creds.accessJwt,
          refreshJwt: creds.refreshJwt,
        },
      }
    },
  })
}

const validateInputsForEntrywayPds = async (
  ctx: AppContext,
  input: CreateAccountInput,
) => {
  const { did, plcOp } = input
  const handle = baseNormalizeAndValidate(input.handle)
  if (!did || !input.plcOp) {
    throw new InvalidRequestError(
      'non-entryway pds requires bringing a DID and plcOp',
    )
  }
  if (!check.is(plcOp, plc.def.operation)) {
    throw new InvalidRequestError('invalid plc operation', 'IncompatibleDidDoc')
  }
  const plcRotationKey = ctx.cfg.entryway?.plcRotationKey
  if (!plcRotationKey || !plcOp.rotationKeys.includes(plcRotationKey)) {
    throw new InvalidRequestError(
      'PLC DID does not include service rotation key',
      'IncompatibleDidDoc',
    )
  }
  try {
    await plc.assureValidOp(plcOp)
    await plc.assureValidSig([plcRotationKey], plcOp)
  } catch (err) {
    throw new InvalidRequestError('invalid plc operation', 'IncompatibleDidDoc')
  }
  const doc = plc.formatDidDoc({ did, ...plcOp })
  const data = ensureAtpDocument(doc)

  let signingKey: ExportableKeypair | undefined
  if (input.did) {
    signingKey = await ctx.actorStore.getReservedKeypair(input.did)
  }
  if (!signingKey) {
    signingKey = await ctx.actorStore.getReservedKeypair(data.signingKey)
  }
  if (!signingKey) {
    throw new InvalidRequestError('reserved signing key does not exist')
  }

  validateAtprotoData(data, {
    handle,
    pds: ctx.cfg.service.publicUrl,
    signingKey: signingKey.did(),
  })

  return {
    did,
    handle,
    email: undefined,
    password: undefined,
    inviteCode: undefined,
    signingKey,
    plcOp,
  }
}

const validateInputsForLocalPds = async (
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

  // normalize & ensure valid handle
  const handle = await normalizeAndValidateHandle({
    ctx,
    handle: input.handle,
    did: input.did,
  })

  // check that the invite code still has uses
  if (ctx.cfg.invites.required && inviteCode) {
    await ctx.accountManager.ensureInviteIsAvailable(inviteCode)
  }

  // check that the handle and email are available
  const [handleAccnt, emailAcct] = await Promise.all([
    ctx.accountManager.getAccount(handle),
    ctx.accountManager.getAccountByEmail(email),
  ])
  if (handleAccnt) {
    throw new InvalidRequestError(`Handle already taken: ${handle}`)
  } else if (emailAcct) {
    throw new InvalidRequestError(`Email already taken: ${email}`)
  }

  // determine the did & any plc ops we need to send
  // if the provided did document is poorly setup, we throw
  const signingKey = await Secp256k1Keypair.create({ exportable: true })
  const { did, plcOp } = input.did
    ? await validateExistingDid(ctx, handle, input.did, signingKey)
    : await createDidAndPlcOp(ctx, handle, input, signingKey)

  return { did, handle, email, password, inviteCode, signingKey, plcOp }
}

const createDidAndPlcOp = async (
  ctx: AppContext,
  handle: string,
  input: CreateAccountInput,
  signingKey: Keypair,
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
    signingKey: signingKey.did(),
    rotationKeys,
    handle,
    pds: ctx.cfg.service.publicUrl,
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
  signingKey: Keypair,
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
      `could not resolve valid DID document :${did}`,
      'UnresolvableDid',
    )
  }
  validateAtprotoData(atpData, {
    handle,
    pds: ctx.cfg.service.publicUrl,
    signingKey: signingKey.did(),
  })

  if (did.startsWith('did:plc')) {
    const data = await ctx.plcClient.getDocumentData(did)
    if (!data.rotationKeys.includes(ctx.plcRotationKey.did())) {
      throw new InvalidRequestError(
        'PLC DID does not include service rotation key',
        'IncompatibleDidDoc',
      )
    }
  }

  return { did: did, plcOp: null }
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
