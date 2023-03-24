import * as crypto from '@atproto/crypto'
import * as uint8arrays from 'uint8arrays'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.createInviteCode({
    auth: ctx.adminVerifier,
    handler: async ({ input, req }) => {
      const { useCount } = input.body

      // generate a 7 char b32 invite code - preceded by the hostname
      // with '.'s replaced by '-'s so it is not mistakable for a link
      // ex: bsky-app-abc2345
      // regex: bsky-app-[a-z2-7]{7}
      const code =
        ctx.cfg.publicHostname.replaceAll('.', '-') +
        '-' +
        uint8arrays.toString(await crypto.randomBytes(7), 'base32').slice(0, 7)

      await ctx.db.db
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

      req.log.info({ useCount, code }, 'created invite code')

      return {
        encoding: 'application/json',
        body: { code },
      }
    },
  })
}
