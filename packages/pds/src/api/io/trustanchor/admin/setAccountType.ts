import { InvalidRequestError } from '@atproto/xrpc-server'
import { type AccountType } from '../../../../account-manager/db/schema/actor'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import { validateAdminAuth } from './shared'

const VALID_ACCOUNT_TYPES: AccountType[] = [
  'personal',
  'bot',
  'organization',
  'test',
]

export default function (server: Server, ctx: AppContext) {
  server.io.trustanchor.admin.setAccountType({
    handler: async ({ input, req }) => {
      validateAdminAuth(req, ctx)

      const { did, accountType } = input.body

      if (!did || !did.startsWith('did:')) {
        throw new InvalidRequestError(
          'Invalid DID format. Must start with "did:"',
        )
      }

      if (!VALID_ACCOUNT_TYPES.includes(accountType as AccountType)) {
        throw new InvalidRequestError(
          `Invalid accountType. Must be one of: ${VALID_ACCOUNT_TYPES.join(', ')}`,
        )
      }

      const account = await ctx.accountManager.getAccount(did, {
        includeDeactivated: true,
        includeTakenDown: true,
      })
      if (!account) {
        throw new InvalidRequestError(`Account not found: ${did}`)
      }

      await ctx.accountManager.updateAccountType(did, accountType as AccountType)

      return {
        encoding: 'application/json',
        body: { success: true },
      }
    },
  })
}
