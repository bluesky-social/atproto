import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.eu.wsocial.server.allocateWidForAccount({
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Any authenticated user may call this; we check accountType below.
      },
    }),
    handler: async ({ auth, req }) => {
      const did = (auth as any).credentials.did as string

      // Guard: only unverified accounts need a WID onboarding QR.
      const account = await ctx.accountManager.getAccount(did)
      if (!account) {
        throw new InvalidRequestError('Account not found')
      }
      if (account.accountType !== 'unverified') {
        throw new InvalidRequestError(
          'Account already has a W Identity association.',
          'AlreadyLinked',
        )
      }

      // Allocate one WID account from inventory for this user's email.
      // If none are available, return a typed error the client can handle.
      const email = account.email ?? ''
      const inventoryAccount =
        await ctx.widInventoryManager.allocateAccount(email)

      if (!inventoryAccount) {
        req.log.warn({ did }, 'allocateWidForAccount: inventory empty')
        throw new InvalidRequestError(
          'No W Identity accounts are available. Please try again later.',
          'InventoryEmpty',
        )
      }

      req.log.info(
        { did, jid: inventoryAccount.did.substring(0, 8) + '...' },
        'allocateWidForAccount: inventory account allocated',
      )

      // expiresAt is derived from created_at (when the WID operator provisioned
      // the batch), not allocated_at. The QR code lifetime starts at provisioning
      // time, and the idempotency window uses the same TTL, so these stay in sync.
      const ttlMs = ctx.cfg.wsocial.widInventoryTtlDays * 24 * 60 * 60 * 1000
      const expiresAt = new Date(
        new Date(inventoryAccount.created_at).getTime() + ttlMs,
      ).toISOString()

      return {
        encoding: 'application/json',
        body: {
          qrCodeUrl: inventoryAccount.qr_code_url ?? '',
          expiresAt,
        },
      }
    },
  })
}
