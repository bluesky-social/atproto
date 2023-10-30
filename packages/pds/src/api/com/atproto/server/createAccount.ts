import { MINUTE } from '@atproto/common'
import { AtprotoData } from '@atproto/identity'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Keypair, Secp256k1Keypair } from '@atproto/crypto'
import disposable from 'disposable-email'
import { normalizeAndValidateHandle } from '../../../../handle'
import * as plc from '@did-plc/lib'
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
      const { email, password, inviteCode } = input.body
      if (input.body.plcOp) {
        throw new InvalidRequestError('Unsupported input: "plcOp"')
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
      const { did, plcOp } = await getDidAndPlcOp(
        ctx,
        handle,
        input.body,
        signingKey,
      )

      const commit = await ctx.actorStore.create(
        did,
        signingKey,
        (actorTxn) => {
          return actorTxn.repo.createRepo([])
        },
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
      const { accessJwt, refreshJwt } = await ctx.accountManager.createAccount({
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

      const didDoc = await didDocForSession(ctx, did, true)

      return {
        encoding: 'application/json',
        body: {
          handle,
          did: did,
          didDoc,
          accessJwt,
          refreshJwt,
        },
      }
    },
  })
}

const getDidAndPlcOp = async (
  ctx: AppContext,
  handle: string,
  input: CreateAccountInput,
  signingKey: Keypair,
): Promise<{
  did: string
  plcOp: plc.Operation | null
}> => {
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
  } else if (atpData.pds !== ctx.cfg.service.publicUrl) {
    throw new InvalidRequestError(
      'DID document pds endpoint does not match service endpoint',
      'IncompatibleDidDoc',
    )
  } else if (atpData.signingKey !== signingKey.did()) {
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
