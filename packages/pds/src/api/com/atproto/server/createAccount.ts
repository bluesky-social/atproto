import * as plc from '@did-plc/lib'
import { isEmailValid } from '@hapi/address'
import { isDisposableEmail } from 'disposable-email-domains-js'
import { DidDocument, MINUTE, check } from '@atproto/common'
import { ExportableKeypair, Keypair, Secp256k1Keypair } from '@atproto/crypto'
import { AtprotoData, ensureAtpDocument } from '@atproto/identity'
import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { AccountStatus } from '../../../../account-manager/account-manager'
import { NEW_PASSWORD_MAX_LENGTH } from '../../../../account-manager/helpers/scrypt'
import { AppContext } from '../../../../context'
import { baseNormalizeAndValidate } from '../../../../handle'
import { Server } from '../../../../lexicon'
import { InputSchema as CreateAccountInput } from '../../../../lexicon/types/com/atproto/server/createAccount'
import { syncEvtDataFromCommit } from '../../../../sequencer'
import { safeResolveDidDoc } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.createAccount({
    rateLimit: {
      durationMs: 5 * MINUTE,
      points: 100,
    },
    auth: ctx.authVerifier.userServiceAuthOptional,
    handler: async ({ input, auth, req }) => {
      // @NOTE Until this code and the OAuthStore's `createAccount` are
      // refactored together, any change made here must be reflected over there.

      const requester = auth.credentials?.did ?? null
      const {
        did,
        handle,
        email,
        password,
        inviteCode,
        signingKey,
        plcOp,
        deactivated,
      } = ctx.entrywayAgent
        ? await validateInputsForEntrywayPds(ctx, input.body)
        : await validateInputsForLocalPds(ctx, input.body, requester)

      // Pre-validate Neuro Legal ID before creating account
      if (password && password.includes('@') && password.includes('legal.')) {
        if (!ctx.neuroAuthManager) {
          throw new InvalidRequestError(
            'Neuro authentication is not configured on this server. Please use a regular password instead.',
          )
        }

        // Check if this Legal ID is already linked
        const existingLink = await ctx.accountManager.db.db
          .selectFrom('neuro_identity_link')
          .select('did')
          .where('legalId', '=', password)
          .executeTakeFirst()

        if (existingLink) {
          throw new InvalidRequestError(
            'This Neuro Legal ID is already linked to another account. Each Legal ID can only be used for one account.',
          )
        }

        // Verify ownership of Legal ID via RemoteLogin
        if (!ctx.neuroRemoteLoginManager) {
          throw new InvalidRequestError(
            'Neuro RemoteLogin is not configured on this server.',
          )
        }

        req.log.info(
          { legalId: password, handle },
          'Verifying Legal ID ownership during account creation',
        )

        const purpose = `Create account: ${handle}`
        const { petitionId } =
          await ctx.neuroRemoteLoginManager.initiatePetition(password, purpose)

        // Wait for user approval on Neuro app
        try {
          await ctx.neuroRemoteLoginManager.waitForApproval(petitionId)
          req.log.info(
            { legalId: password, handle },
            'Legal ID ownership verified',
          )
        } catch (err) {
          req.log.error(
            { err, legalId: password, handle },
            'Failed to verify Legal ID ownership',
          )
          throw new InvalidRequestError(
            'Failed to verify ownership of Neuro Legal ID. Please approve the login request on your Neuro app.',
          )
        }
      }
      // Regular password - no special validation needed

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

        didDoc = await safeResolveDidDoc(ctx, did, true)

        creds = await ctx.accountManager.createAccountAndSession({
          did,
          handle,
          email,
          password,
          repoCid: commit.cid,
          repoRev: commit.rev,
          inviteCode,
          deactivated,
        })

        // If password looks like a Neuro Legal ID, link the account
        if (password && password.includes('@') && password.includes('legal.')) {
          if (!ctx.neuroAuthManager) {
            throw new InvalidRequestError(
              'Neuro authentication is not configured on this server. Please use a regular password instead.',
            )
          }

          try {
            req.log.info(
              { did, legalId: password },
              'Linking Neuro identity during account creation',
            )
            await ctx.neuroAuthManager.linkIdentity(password, did, email)
          } catch (err) {
            req.log.error(
              { err, did, legalId: password },
              'Failed to link Neuro identity',
            )
            const errorMsg = err instanceof Error ? err.message : String(err)

            if (errorMsg.includes('UNIQUE constraint failed')) {
              throw new InvalidRequestError(
                'This Neuro Legal ID is already linked to another account. Each Legal ID can only be used for one account.',
              )
            } else {
              throw new InvalidRequestError(
                `Failed to link Neuro Legal ID: ${errorMsg}. Please ensure you entered a valid Neuro Legal ID or use a regular password instead.`,
              )
            }
          }
        }

        if (!deactivated) {
          await ctx.sequencer.sequenceIdentityEvt(did, handle)
          await ctx.sequencer.sequenceAccountEvt(did, AccountStatus.Active)
          await ctx.sequencer.sequenceCommit(did, commit)
          await ctx.sequencer.sequenceSyncEvt(
            did,
            syncEvtDataFromCommit(commit),
          )
        }
        await ctx.accountManager.updateRepoRoot(did, commit.cid, commit.rev)
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
    deactivated: false,
  }
}

const validateInputsForLocalPds = async (
  ctx: AppContext,
  input: CreateAccountInput,
  requester: string | null,
) => {
  const { email, password, inviteCode } = input
  if (input.plcOp) {
    throw new InvalidRequestError('Unsupported input: "plcOp"')
  }

  if (password && password.length > NEW_PASSWORD_MAX_LENGTH) {
    throw new InvalidRequestError(
      `Password too long. Maximum length is ${NEW_PASSWORD_MAX_LENGTH} characters.`,
    )
  }

  if (ctx.cfg.invites.required && !inviteCode) {
    throw new InvalidRequestError(
      'No invite code provided',
      'InvalidInviteCode',
    )
  }

  if (!email) {
    throw new InvalidRequestError('Email is required')
  } else if (!isEmailValid(email) || isDisposableEmail(email)) {
    throw new InvalidRequestError(
      'This email address is not supported, please use a different email.',
    )
  }

  // normalize & ensure valid handle
  const handle = await ctx.accountManager.normalizeAndValidateHandle(
    input.handle,
    { did: input.did },
  )

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

  let did: string
  let plcOp: plc.Operation | null
  let deactivated = false
  if (input.did) {
    if (input.did !== requester) {
      throw new AuthRequiredError(
        `Missing auth to create account with did: ${input.did}`,
      )
    }
    did = input.did
    plcOp = null
    deactivated = true
  } else {
    const formatted = await formatDidAndPlcOp(ctx, handle, input, signingKey)
    did = formatted.did
    plcOp = formatted.plcOp
  }

  return {
    did,
    handle,
    email,
    password,
    inviteCode,
    signingKey,
    plcOp,
    deactivated,
  }
}

const formatDidAndPlcOp = async (
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
