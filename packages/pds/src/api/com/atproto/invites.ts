import * as crypto from '@atproto/crypto'
import * as uint8arrays from 'uint8arrays'
import { Server } from '../../../lexicon'
import * as locals from '../../../locals'
import ServerAuth from '../../../auth'

export default function (server: Server) {
  server.com.atproto.account.createInviteCode({
    auth: ServerAuth.adminVerifier,
    handler: async ({ input, res }) => {
      const { db, config, logger } = locals.get(res)
      const { useCount } = input.body

      // generate a 5 char b32 invite code - preceeded by the hostname
      // ex: bsky.app-abc12
      const code =
        config.publicHostname +
        '-' +
        uint8arrays.toString(await crypto.randomBytes(5), 'base32').slice(0, 5)

      await db.db
        .insertInto('invite_code')
        .values({
          code: code,
          availableUses: useCount,
          disabled: 0,
          forUser: 'admin',
          createdBy: 'admin',
          createdAt: new Date().toISOString(),
        })
        .execute()

      logger.info({ useCount, code }, 'created invite code')

      return {
        encoding: 'application/json',
        body: { code },
      }
    },
  })
}
