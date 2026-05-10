import * as plc from '@did-plc/lib'
import { Secp256k1Keypair } from '@atproto/crypto'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AccountStatus } from '../../../../account-manager/account-manager'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { sendIdentityEventWithRetry } from '../../../../sequencer/identity-event-helper'
import { validateAdminAuth } from './shared'

export default function (server: Server, ctx: AppContext) {
  server.io.trustanchor.admin.createBotAccount({
    handler: async ({ input, req }) => {
      validateAdminAuth(req, ctx)
      const { handle, email, privileged = true } = input.body

      // Bot accounts can have any handle (no prefix requirement)

      // Build full handle
      const fullHandle = handle.includes('.')
        ? handle
        : `${handle}.${ctx.cfg.service.hostname}`

      req.log.info({ handle: fullHandle }, 'Creating bot account')

      // Check if handle is available
      const handleTaken = await ctx.accountManager.db.db
        .selectFrom('actor')
        .select('handle')
        .where('handle', '=', fullHandle)
        .executeTakeFirst()

      if (handleTaken) {
        throw new InvalidRequestError(`Handle ${fullHandle} is not available`)
      }

      // Generate signing keypair
      const signingKey = await Secp256k1Keypair.create({ exportable: true })

      // Create PLC DID operation
      const plcCreate = await plc.createOp({
        signingKey: signingKey.did(),
        rotationKeys: [ctx.plcRotationKey.did()],
        handle: fullHandle,
        pds: ctx.cfg.service.publicUrl,
        signer: ctx.plcRotationKey,
      })

      const did = plcCreate.did

      // Create actor repo
      await ctx.actorStore.create(did, signingKey)
      const commit = await ctx.actorStore.transact(did, (actorTxn) =>
        actorTxn.repo.createRepo([]),
      )

      // Publish DID to PLC
      await ctx.plcClient.sendOperation(did, plcCreate.op)

      req.log.info({ did, handle: fullHandle }, 'Actor and DID created')

      // Create account (no password - will use app password only)
      // Use synthetic email if not provided
      const accountEmail = email || `${did.split(':').pop()}@noemail.invalid`
      await ctx.accountManager.createAccount({
        did,
        handle: fullHandle,
        email: accountEmail,
        password: undefined, // Bot accounts authenticate with app password only
        repoCid: commit.cid,
        repoRev: commit.rev,
        accountType: 'bot',
      })

      // Mark email as confirmed (skip verification for bot accounts)
      await ctx.accountManager.db.db
        .updateTable('account')
        .set({ emailConfirmedAt: new Date().toISOString() })
        .where('did', '=', did)
        .execute()

      req.log.info({ did, handle: fullHandle }, 'Account created')

      // Sequence events
      await sendIdentityEventWithRetry(
        ctx.sequencer,
        ctx.backgroundQueue,
        did,
        fullHandle,
        req.log,
        'bot account creation',
      )

      await ctx.sequencer.sequenceAccountEvt(did, AccountStatus.Active)
      await ctx.sequencer.sequenceCommit(did, commit)

      // Create app password
      const appPassword = await ctx.accountManager.createAppPassword(
        did,
        'bot-login',
        privileged,
      )

      // Generate deep link
      const deepLink = generateDeepLink(
        ctx.cfg.service.publicUrl,
        fullHandle,
        appPassword.password,
      )

      req.log.info(
        { did, handle: fullHandle, deepLink },
        'Bot account created with deep link',
      )

      return {
        encoding: 'application/json',
        body: {
          did,
          handle: fullHandle,
          appPassword: appPassword.password,
          deepLink,
        },
      }
    },
  })
}

function generateDeepLink(
  server: string,
  username: string,
  password: string,
): string {
  const params = new URLSearchParams({
    server,
    user: username,
    pass: password,
  })
  return `wsocial://login?${params.toString()}`
}
