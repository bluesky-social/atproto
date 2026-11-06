import * as plc from '@did-plc/lib'
import { isEmailValid } from '@hapi/address'
import { isDisposableEmail } from 'disposable-email-domains-js'
import { MINUTE, check } from '@atproto/common'
import {
  type ExportableKeypair,
  type Keypair,
  Secp256k1Keypair,
} from '@atproto/crypto'
import { type AtprotoData, ensureAtpDocument } from '@atproto/identity'
import type { DidString, HandleString } from '@atproto/syntax'
import {
  AuthRequiredError,
  InvalidRequestError,
  type MethodAuthVerifier,
  type Server,
} from '@atproto/xrpc-server'
import { NEW_PASSWORD_MAX_LENGTH } from '../../../../account-manager/helpers/scrypt.js'
import type {
  AdminTokenOutput,
  UnauthenticatedOutput,
  UserServiceAuthOutput,
} from '../../../../auth-output.js'
import type { AppContext } from '../../../../context.js'
import { events } from '../../../../events.js'
import { baseNormalizeAndValidate } from '../../../../handle/index.js'
import { com } from '../../../../lexicons/index.js'
import { safeResolveDidDoc } from './util.js'

export default function (server: Server, ctx: AppContext) {
  // Behind an entryway, the entryway calls this route with its admin
  // credentials when migrating an existing account in.
  const auth: MethodAuthVerifier<
    UserServiceAuthOutput | AdminTokenOutput | UnauthenticatedOutput
  > = ctx.entrywayClient
    ? ctx.authVerifier.userServiceAuthOrAdminTokenOptional
    : ctx.authVerifier.userServiceAuthOptional

  server.add(com.atproto.server.createAccount, {
    rateLimit: {
      durationMs: 5 * MINUTE,
      points: 100,
    },
    auth,
    handler: async ({
      input,
      auth,
      req,
    }): Promise<com.atproto.server.createAccount.$Output> => {
      // @NOTE Until this code and the OAuthStore's `createAccount` are
      // refactored together, any change made here must be reflected over there.

      const requester =
        auth.credentials?.type === 'user_service_auth'
          ? auth.credentials.did
          : null
      const {
        did,
        handle,
        email,
        password,
        inviteCode,
        signingKey,
        plcOp,
        deactivated,
      } = ctx.entrywayClient
        ? await validateInputsForEntrywayPds(ctx, input.body, auth)
        : await validateInputsForLocalPds(ctx, input.body, requester)

      await ctx.actorStore.create(did, signingKey)

      try {
        const commit = await ctx.actorStore.transact(did, (actorTxn) => {
          return actorTxn.repo.createRepo([])
        })

        const canTombstone =
          // @NOTE IMPORTANT Because the user may be bringing their own did, we
          // must make sure not to tombstone their did on failure if we didn't
          // create it here.
          !ctx.entrywayClient && !input.body.did && !!plcOp

        // Generate a real did with PLC
        if (plcOp) {
          await ctx.plcClient.sendOperation(did, plcOp)
        }

        try {
          const didDoc = await safeResolveDidDoc(ctx, did, true)

          const creds = await ctx.accountManager.createAccountAndSession({
            did,
            handle,
            email,
            password,
            repoCid: commit.cid,
            repoRev: commit.rev,
            inviteCode,
            deactivated,
          })

          try {
            const sequenceEvt = !deactivated
            if (sequenceEvt) {
              await ctx.sequencer.sequenceAccountCreation(did, handle, commit)
            }

            try {
              await ctx.actorStore
                .clearReservedKeypair(signingKey.did(), did)
                .catch((err) => {
                  // @NOTE This is a cleanup operation so we won't fail the whole
                  // flow if it fails, but we log it just in case
                  req.log.error(
                    { did, signingKeyDid: signingKey.did(), err },
                    'Failed to clear reserved keypair',
                  )
                })

              events.accountCreated({
                source: com.atproto.server.createAccount.$lxm,
                did,
                invited: !!inviteCode,
                deactivated,
              })
              events.sessionCreated({
                source: com.atproto.server.createAccount.$lxm,
                did,
              })

              return {
                encoding: 'application/json' as const,
                body: {
                  handle,
                  did: did,
                  // @ts-expect-error https://github.com/bluesky-social/atproto/pull/4406
                  didDoc,
                  accessJwt: creds.accessJwt,
                  refreshJwt: creds.refreshJwt,
                },
              }
            } catch (err) {
              if (sequenceEvt) await ctx.sequencer.sequenceAccountDeletion(did)
              throw err
            }
          } catch (err) {
            await ctx.accountManager.deleteAccount(did)
            throw err
          }
        } catch (err) {
          if (canTombstone) {
            await ctx.plcClient.tombstone(did, ctx.plcRotationKey)
          }
          throw err
        }
      } catch (err) {
        await ctx.actorStore.destroy(did)
        throw err
      }
    },
  })
}

const validateInputsForEntrywayPds = async (
  ctx: AppContext,
  input: com.atproto.server.createAccount.$InputBody,
  auth: UserServiceAuthOutput | AdminTokenOutput | UnauthenticatedOutput,
) => {
  const handle = baseNormalizeAndValidate(input.handle)

  const { did, plcOp } = input
  if (!did) {
    throw new InvalidRequestError('entryway pds requires bringing a DID')
  }
  if (!plcOp) {
    return validateInputsForEntrywayMigration(ctx, did, handle, auth)
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

/**
 * Migrating an existing account (did:plc or did:web) into a PDS that sits
 * behind an entryway. The entryway owns the user's credentials and is
 * responsible for verifying that the user controls the DID (e.g. via a service
 * auth token minted by their current PDS) before calling this route with its
 * admin credentials.
 */
const validateInputsForEntrywayMigration = async (
  ctx: AppContext,
  did: DidString,
  handle: HandleString,
  auth: UserServiceAuthOutput | AdminTokenOutput | UnauthenticatedOutput,
) => {
  if (auth.credentials?.type !== 'admin_token') {
    throw new AuthRequiredError(
      'entryway pds requires a plcOp, or entryway admin auth to migrate an existing DID',
    )
  }

  // the entryway is authoritative for handles, but the handle must still be
  // available on this pds.
  const existing = await ctx.accountManager.getAccount(handle, {
    includeTakenDown: true,
    includeDeactivated: true,
  })
  if (existing) {
    throw new InvalidRequestError(
      `Handle already taken: ${handle}`,
      'HandleNotAvailable',
    )
  }

  const signingKey =
    (await ctx.actorStore.getReservedKeypair(did)) ??
    (await Secp256k1Keypair.create({ exportable: true }))

  return {
    did,
    handle,
    email: undefined,
    password: undefined,
    inviteCode: undefined,
    signingKey,
    plcOp: null,
    deactivated: true,
  }
}

const validateInputsForLocalPds = async (
  ctx: AppContext,
  input: com.atproto.server.createAccount.$InputBody,
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
  //
  // `actor_handle_lower_idx` and `account_email_lower_idx` enforce handle and
  // email uniqueness across taken down and deactivated accounts as well, so we
  // must check for them when surfacing handle availability.
  const availability = { includeTakenDown: true, includeDeactivated: true }
  const [handleAccnt, emailAcct] = await Promise.all([
    ctx.accountManager.getAccount(handle, availability),
    ctx.accountManager.getAccountByEmail(email, availability),
  ])
  if (handleAccnt) {
    throw new InvalidRequestError(`Handle already taken: ${handle}`)
  } else if (emailAcct) {
    throw new InvalidRequestError(`Email already taken: ${email}`)
  }

  // determine the did & any plc ops we need to send
  // if the provided did document is poorly setup, we throw
  const signingKey = await Secp256k1Keypair.create({ exportable: true })

  let did: DidString
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
    did = formatted.did as DidString
    plcOp = formatted.op
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
  input: com.atproto.server.createAccount.$InputBody,
  signingKey: Keypair,
) => {
  // if the user is not bringing a DID, then we format a create op for PLC
  const rotationKeys = [ctx.plcRotationKey.did()]
  if (ctx.cfg.identity.recoveryDidKey) {
    rotationKeys.unshift(ctx.cfg.identity.recoveryDidKey)
  }
  if (input.recoveryKey) {
    rotationKeys.unshift(input.recoveryKey)
  }
  return plc.createOp({
    signingKey: signingKey.did(),
    rotationKeys,
    handle,
    pds: ctx.cfg.service.publicUrl,
    signer: ctx.plcRotationKey,
  })
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
